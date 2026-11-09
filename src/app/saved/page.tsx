import type { Metadata } from "next";
import { SavedView } from "@/components/account/saved-view";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved schools and places" };

export default async function SavedPage() {
  const me = await currentUser().catch(() => null);
  return <SavedView signedIn={Boolean(me)} />;
}
