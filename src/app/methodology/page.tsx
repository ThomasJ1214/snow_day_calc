import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/lib/official/registry.json";

export const metadata: Metadata = { title: "How SnowDay works", description: "Data sources, models, snowfall math and the school closure model behind SnowDay." };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-8">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-text-2 [&_strong]:text-text">{children}</div>
    </section>
  );
}

export default function Methodology() {
  const n = (registry as { districts: unknown[] }).districts.length;
  return (
    <article className="mx-auto max-w-3xl space-y-10 leading-relaxed">
      <header>
        <h1 className="font-display text-5xl font-extrabold tracking-tight">How SnowDay works</h1>
        <p className="mt-4 text-lg text-text-2">
          Every number on SnowDay comes from a public weather or education dataset. When a source is missing, the page says so instead of filling the gap.
        </p>
      </header>

      <Section id="sources" title="Where the forecasts come from">
        <p>
          For each location SnowDay requests six deterministic models through Open-Meteo: <strong>NOAA&apos;s National Blend of Models</strong> (2.5 km),{" "}
          <strong>HRRR</strong> (3 km, 48 hours), <strong>GFS</strong>, <strong>ECMWF IFS</strong>, Environment Canada&apos;s <strong>GEM</strong> and DWD&apos;s{" "}
          <strong>ICON</strong>, plus <strong>82 ensemble members</strong> (NOAA GEFS and ECMWF ENS).
        </p>
        <p>
          SnowDay also downloads <strong>HRRR directly from NOAA&apos;s open-data bucket</strong> and decodes the raw GRIB2 files itself (Lambert conformal grid, complex
          packing with spatial differencing), then uses them for the national map and as an independent check. The <strong>National Weather Service</strong> supplies
          active alerts, the written forecast and the forecaster-made snowfall grid (NDFD).
        </p>
        <p>
          NOAA&apos;s <strong>RRFS</strong> is the planned successor to HRRR, but operational RRFS output isn&apos;t yet published on NOAA&apos;s open data service, so
          SnowDay lists it as not yet available rather than substituting another model under its name.
        </p>
      </Section>

      <Section id="snow" title="Turning precipitation into snow">
        <p>
          For every hour of every model run, SnowDay computes the wet-bulb temperature (Stull 2011) to decide whether precipitation falls as snow, a mix, rain or
          freezing rain, then converts liquid to snow with a temperature-dependent snow-to-liquid ratio: about 10:1 near freezing, 13:1 in typical cold air, 17:1 in
          the dendrite-friendly −8 to −14 °C range, lower for wet snow and when strong wind breaks up flakes. Where a model&apos;s own snowfall disagrees in marginal
          air, the lower value is used.
        </p>
        <p>
          <strong>Low, most likely and high</strong> are the 10th, 50th and 90th percentiles of the ensemble members&apos; totals. If ensembles are unavailable, the
          range falls back to the spread between deterministic models and the page labels it that way. <strong>Confidence</strong> drops as the models disagree and as
          the snow&apos;s start time moves further out.
        </p>
        <p>
          Forecasts describe a model grid cell a few kilometers across. They are not street-level measurements, and lake-effect bands or coastal fronts can create
          sharp differences across short distances.
        </p>
      </Section>

      <Section id="closure" title="The school closure model">
        <p>
          The prediction targets the next school day, skipping weekends, federal holidays and any days off found in the district&apos;s published calendar. It uses the
          forecast at the school&apos;s own coordinates for snow from 6 PM to 7 AM, snow during the 5–8 AM commute, freezing rain, the morning low and wind chill, gusts,
          visibility and active NWS winter alerts.
        </p>
        <p>
          The same storm matters more where snow is rare, so snow thresholds scale with the area&apos;s average annual snowfall from{" "}
          <strong>NOAA&apos;s 1991–2020 climate normals</strong> at nearby stations. Four inches overnight is a likely closure in Atlanta and often just a delay in
          Buffalo. Ice is weighted heavily everywhere. Each factor adds points; the total maps to closure and delay probabilities through a fixed logistic curve, and
          every school page shows each factor&apos;s contribution.
        </p>
        <p>
          Montville Township, New Jersey gets extra care: SnowDay reads the district&apos;s own alert banner and calendar, and its record of past weather closures comes
          straight from the district&apos;s announcements. SnowDay logs its own predictions so accuracy can be measured against verified outcomes; a Brier score appears
          once ten checkable days exist.
        </p>
      </Section>

      <Section id="official" title="Official announcements">
        <p>
          A prediction never becomes an &quot;official&quot; status. SnowDay reads announcements only from sources a district publishes itself: today {n} districts with
          a machine-readable news feed or alert banner (found and validated by a script that checks each district&apos;s NCES-listed website). Posts older than 18 hours
          are ignored, and phrases like &quot;no delay&quot; or &quot;winter break&quot; aren&apos;t mistaken for weather closures.
        </p>
        <p>Everywhere else the status reads &quot;Official information unavailable&quot; with a link to the district&apos;s official website.</p>
      </Section>

      <Section id="schools" title="Schools">
        <p>
          The directory is the U.S. Department of Education&apos;s <strong>NCES Common Core of Data</strong> (about 102,000 public schools) and{" "}
          <strong>Private School Survey</strong> (about 22,500 schools). Private schools that didn&apos;t respond to the survey won&apos;t appear, and district websites come
          from the NCES directory, corrected where SnowDay has verified a newer address.
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>
          You don&apos;t need an account. Without one, favorites and recent searches stay in your browser. With one, SnowDay stores your email, saved schools and places,
          notification settings and push subscription, and nothing else. Your location is used only to find your forecast and is never stored.
        </p>
      </Section>

      <p className="text-text-3">
        Questions or a district feed to add? Open an issue on the{" "}
        <Link className="text-ice underline" href="https://github.com/ThomasJ1214/snow_day_calc">
          project repository
        </Link>
        .
      </p>
    </article>
  );
}
