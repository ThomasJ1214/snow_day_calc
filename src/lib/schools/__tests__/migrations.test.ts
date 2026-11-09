import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const dir = path.join(__dirname, "../../../../supabase/migrations");
let db: PGlite;

/** Supabase provides these roles/functions; PGlite needs minimal stand-ins to run the migrations. */
const SUPABASE_SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_SHIM);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  await db.exec(`
    insert into districts (leaid, name, state, city, zip, website) values
      ('3410650', 'Montville Township School District', 'NJ', 'Pine Brook', '07058', 'https://www.montville.net'),
      ('2503270', 'Cambridge', 'MA', 'Cambridge', '02141', 'https://www.cpsd.us');
    insert into schools (id, ncessch, type, name, leaid, district_name, street, city, state, zip, lat, lon) values
      ('pub-341065004079', '341065004079', 'public', 'Montville Township High School', '3410650', 'Montville Township School District', '100 Horseneck Rd', 'Montville', 'NJ', '07045', 40.8997, -74.3577),
      ('pub-341065001234', '341065001234', 'public', 'Robert R. Lazar Middle School', '3410650', 'Montville Township School District', '123 Changebridge Rd', 'Montville', 'NJ', '07045', 40.9107, -74.3700),
      ('pub-250327000436', '250327000436', 'public', 'Cambridge Rindge and Latin', '2503270', 'Cambridge', '459 Broadway', 'Cambridge', 'MA', '02138', 42.3742, -71.1120);
    insert into schools (id, ppin, type, name, street, city, state, zip, lat, lon) values
      ('pvt-A9501234', 'A9501234', 'private', 'Montville Montessori', '1 Main St', 'Montville', 'NJ', '07045', 40.91, -74.36);
  `);
});

describe("supabase migrations: school search", () => {
  it("finds schools by misspelled name (trigram similarity)", async () => {
    const r = await db.query<{ name: string }>(`select name from search_schools('montvile high', null, null, 10)`);
    expect(r.rows[0].name).toBe("Montville Township High School");
  });
  it("filters by ZIP code", async () => {
    const r = await db.query<{ name: string }>(`select name from search_schools(null, null, '07045', 10) order by name`);
    expect(r.rows.map((x) => x.name)).toEqual(["Montville Montessori", "Montville Township High School", "Robert R. Lazar Middle School"]);
  });
  it("finds schools by district name", async () => {
    const r = await db.query<{ name: string }>(`select name from search_schools('Montville Township School District', 'NJ', null, 10)`);
    expect(r.rows.length).toBeGreaterThanOrEqual(2);
  });
  it("finds schools by city with state filter", async () => {
    const r = await db.query<{ name: string }>(`select name from search_schools('Cambridge', 'MA', null, 10)`);
    expect(r.rows[0].name).toBe("Cambridge Rindge and Latin");
  });
  it("returns schools near a point ordered by distance with district website", async () => {
    const r = await db.query<{ name: string; distance_km: number; district_website: string }>(
      `select name, distance_km, district_website from schools_near(40.9154, -74.3638, 5, 10)`,
    );
    expect(r.rows.length).toBe(3);
    expect(r.rows[0].distance_km).toBeLessThan(r.rows[2].distance_km);
    expect(r.rows.find((x) => x.name.startsWith("Montville Township"))?.district_website).toBe("https://www.montville.net");
  });
  it("is protected by row level security for writes", async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname = 'schools'`);
    expect(r.rows[0].relrowsecurity).toBe(true);
  });
});

describe("supabase migrations: accounts are private to their owner", () => {
  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";
  it("hides one user's saved schools from another and blocks forged inserts", async () => {
    await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.test'), ('${B}', 'b@x.test');`);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`);
    await db.exec(`insert into saved_schools (school_id, school_name, lat, lon) values ('pub-341065004079', 'Montville Township High School', 40.9, -74.36);`);
    expect((await db.query(`select * from saved_schools`)).rows).toHaveLength(1);
    await db.exec(`select set_config('request.jwt.claim.sub', '${B}', false);`);
    expect((await db.query(`select * from saved_schools`)).rows).toHaveLength(0);
    await expect(
      db.exec(`insert into saved_schools (user_id, school_id, school_name, lat, lon) values ('${A}', 'pub-1', 'Forged', 0, 0);`),
    ).rejects.toThrow(/row-level security/);
    await db.exec(`reset role;`);
  });
  it("lets anyone read verified closure history but not write it", async () => {
    await db.exec(`insert into closure_events (leaid, district, school_day, status, source_url, evidence, origin) values ('3410650', 'Montville', '2026-02-23', 'closed', 'https://www.montville.net', 'Due to inclement weather…', 'district-archive');`);
    await db.exec(`set role anon;`);
    expect((await db.query(`select * from closure_events`)).rows).toHaveLength(1);
    await expect(db.exec(`insert into closure_events (leaid, district, school_day, status, source_url, evidence, origin) values ('1', 'x', '2026-01-01', 'closed', 'https://x', 'x', 'verifier');`)).rejects.toThrow();
    await db.exec(`reset role;`);
  });
});
