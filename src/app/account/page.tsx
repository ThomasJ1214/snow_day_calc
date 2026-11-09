import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { AccountView } from "@/components/account/account-view";
import { Notice, Panel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  if (!supabaseConfigured)
    return (
      <div className="max-w-xl">
        <Notice title="Accounts are not configured on this deployment">
          Favorites and recent searches are saved on this device. The site owner can enable accounts and notifications by adding Supabase keys (see the README).
        </Notice>
      </div>
    );
  const me = await currentUser().catch(() => null);
  if (!me)
    return (
      <div className="mx-auto max-w-md">
        <Panel strong>
          <h1 className="font-display text-3xl font-bold">Your account</h1>
          <p className="mt-2 text-text-2">Sign in to sync saved schools across devices, add school calendars and get snow-day notifications.</p>
          <Link href="/signin" className="neu-raised-sm neu-press mt-5 inline-flex min-h-11 items-center rounded-2xl bg-accent! px-5 text-sm font-semibold text-on-accent">
            Sign in or create an account
          </Link>
        </Panel>
      </div>
    );
  return <AccountView email={me.user.email ?? "your account"} />;
}
