import type { Metadata } from "next";
import { UnifiedSearch } from "@/components/search/unified-search";
import { MontvilleCard } from "@/components/home/montville-card";
import { RecentChips } from "@/components/home/recents";
import { NationalSnapshot } from "@/components/home/national-snapshot";
import registry from "@/lib/official/registry.json";

// Each page declares its own canonical; the root layout deliberately sets none (children would inherit it).
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  const districts = (registry as { districts: unknown[] }).districts.length;
  return (
    <div className="space-y-20">
      <section className="grid grid-cols-[minmax(0,1fr)] gap-10 pt-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:pt-8">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(2.6rem,6.4vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
            Will there be a snow day?
            <span className="mt-2 block text-[0.62em] leading-[1.05] text-text-2">See the odds before the call.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text-2">
            Snowfall for your exact spot from more than 80 forecast model runs, shown as an honest range instead of a single guess, plus closure odds for any U.S. school
            and the district&apos;s official word the moment it&apos;s posted.
          </p>
          <div className="mt-8">
            <UnifiedSearch size="lg" />
            <RecentChips />
          </div>
        </div>
        <MontvilleCard />
      </section>

      <section aria-label="How Snow Day Scout works" className="grid gap-6 border-y border-line py-8 sm:grid-cols-3">
        <div>
          <p className="font-display text-4xl font-extrabold tabular">82</p>
          <p className="mt-1 text-text-2">ensemble members per location set the low, likely and high totals.</p>
        </div>
        <div>
          <p className="font-display text-4xl font-extrabold tabular">3 km</p>
          <p className="mt-1 text-text-2">NOAA HRRR grids, decoded straight from NOAA&apos;s raw GRIB2 files every hour.</p>
        </div>
        <div>
          <p className="font-display text-4xl font-extrabold tabular">{districts}</p>
          <p className="mt-1 text-text-2">districts whose official announcements Snow Day Scout checks automatically, including Montville Township.</p>
        </div>
      </section>

      <NationalSnapshot />
    </div>
  );
}
