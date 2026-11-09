import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-20 max-w-6xl px-4 pb-28 text-sm text-text-3 sm:px-6 md:pb-12">
      <div className="flex flex-col gap-4 border-t border-line pt-8 md:flex-row md:justify-between">
        <p className="max-w-xl">
          Forecasts from NOAA (HRRR, NBM, GFS, GEFS, NWS), ECMWF, Environment Canada and DWD via Open-Meteo and NOAA open data. School data from NCES. Closure
          predictions are estimates — always confirm with your school district.
        </p>
        <div className="flex gap-5">
          <Link href="/methodology" className="hover:text-text">How it works</Link>
          <Link href="/methodology#sources" className="hover:text-text">Data sources</Link>
          <Link href="/methodology#privacy" className="hover:text-text">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
