import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/account/signin-form";
import { Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Sign in to Snow Day Scout</h1>
        <p className="mt-2 text-text-2">Optional. An account syncs your schools across devices and lets Snow Day Scout notify you before a likely snow day.</p>
      </div>
      <Panel strong>
        <Suspense>
          <SignInForm />
        </Suspense>
      </Panel>
    </div>
  );
}
