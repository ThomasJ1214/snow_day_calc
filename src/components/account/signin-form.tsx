"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { syncFavorites } from "@/lib/client/sync";
import { useFavorites } from "@/lib/client/storage";
import { Button, Notice } from "@/components/ui/primitives";
import { cn } from "@/components/ui/primitives";

export function SignInForm() {
  const db = browserClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/account";
  const { favorites, replace } = useFavorites();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") === "oauth" ? "Google sign-in didn't complete. Please try again." : null);

  if (!db)
    return (
      <Notice title="Accounts are not configured on this deployment">
        Everything else works without an account — favorites and recent searches are saved on this device. The site owner can enable accounts by adding Supabase keys
        (see the README).
      </Notice>
    );

  const finish = async () => {
    const merged = await syncFavorites(favorites);
    if (merged) replace(merged);
    router.replace(next);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await db.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setError("Your account was created, but this deployment still requires email confirmation. The site owner needs to turn off “Confirm email” in Supabase.");
          return;
        }
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await finish();
    } catch (err) {
      const msg = (err as { message?: string }).message ?? "";
      setError(
        /invalid login/i.test(msg)
          ? "That email and password don't match an account. Check them, or create an account."
          : /already registered/i.test(msg)
            ? "An account with this email already exists. Sign in instead."
            : msg || "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) setError("Google sign-in isn't available right now. Use email and password instead.");
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" className="w-full" onClick={google}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-sm text-text-3">
        <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
      </div>
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-full border border-line p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("min-h-10 cursor-pointer rounded-full font-semibold", mode === m ? "bg-surface-strong text-text" : "text-text-3")}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="glass h-12 w-full rounded-xl px-4 text-text focus:outline-none" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="pw-help"
            className="glass h-12 w-full rounded-xl px-4 text-text focus:outline-none"
          />
          <p id="pw-help" className="mt-1.5 text-xs text-text-3">
            At least 8 characters.{mode === "signup" ? " No confirmation email — you're signed in right away." : ""}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
