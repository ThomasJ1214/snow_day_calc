import Link from "next/link";
import { UnifiedSearch } from "@/components/search/unified-search";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-5 py-10">
      <h1 className="font-display text-4xl font-bold">That page melted.</h1>
      <p className="text-text-2">The link may be mistyped, or the location may be outside the United States. Search for a ZIP code, city or school instead.</p>
      <UnifiedSearch size="md" />
      <Link href="/" className="inline-block text-ice underline">
        Back to the home page
      </Link>
    </div>
  );
}
