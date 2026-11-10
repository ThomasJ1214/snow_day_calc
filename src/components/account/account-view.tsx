"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CalendarPlus, LogOut } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { useFavorites } from "@/lib/client/storage";
import { syncFavorites } from "@/lib/client/sync";
import { Button, Notice, Panel, PanelTitle } from "@/components/ui/primitives";

interface Prefs {
  closure_threshold: number;
  snow_threshold_in: number;
  notify_official: boolean;
  enabled: boolean;
}
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function AccountView({ email }: { email: string }) {
  const router = useRouter();
  const { favorites, replace } = useFavorites();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [devices, setDevices] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<{ school_id: string; ics_url: string }[]>([]);
  const [icsDraft, setIcsDraft] = useState<Record<string, string>>({});
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    fetch("/api/me/prefs").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setPrefs(d.prefs);
      setDevices(d.devices);
    });
    fetch("/api/me/calendars").then(async (r) => r.ok && setCalendars((await r.json()).calendars));
    syncFavorites(favorites).then((m) => m && replace(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePrefs = async (p: Prefs) => {
    setPrefs(p);
    const r = await fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    setStatus(r.ok ? "Notification settings saved." : "Couldn't save settings. Please try again.");
  };

  const enablePush = async () => {
    setStatus(null);
    if (!VAPID) return setStatus("Push notifications aren't configured on this deployment.");
    if (!pushSupported) return setStatus("This browser doesn't support push notifications. On iPhone, add Snow Day Scout to your Home Screen first.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("Notifications are blocked. Allow them in your browser's site settings, then try again.");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) }));
    const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    if (r.ok) {
      setDevices((d) => d + 1);
      setStatus("Notifications are on for this device.");
    } else setStatus((await r.json().catch(() => null))?.error?.message ?? "Couldn't register this device.");
  };

  const testPush = async () => {
    const r = await fetch("/api/push/test", { method: "POST" });
    const d = await r.json().catch(() => null);
    setStatus(r.ok ? `Test sent to ${d.sent} device(s).` : d?.error?.message ?? "Test failed.");
  };

  const saveCalendar = async (schoolId: string) => {
    const icsUrl = (icsDraft[schoolId] ?? "").trim().replace(/^webcal:\/\//, "https://");
    const r = await fetch("/api/me/calendars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId, icsUrl }) });
    const d = await r.json().catch(() => null);
    if (r.ok) {
      setCalendars((c) => [...c.filter((x) => x.school_id !== schoolId), { school_id: schoolId, ics_url: icsUrl }]);
      setStatus(`Calendar saved: ${d.noSchoolDays} no-school days found.`);
    } else setStatus(d?.error?.message ?? "Couldn't save that calendar.");
  };

  const signOut = async () => {
    await browserClient()?.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const schools = favorites.filter((f) => f.type === "school");
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Your account</h1>
          <p className="mt-2 text-text-2">Signed in as {email}</p>
        </div>
        <Button variant="ghost" onClick={signOut}>
          <LogOut className="size-4" aria-hidden /> Sign out
        </Button>
      </section>
      {status && <Notice title={status} />}

      <Panel>
        <PanelTitle aside={`${devices} device${devices === 1 ? "" : "s"}`}>
          <span className="inline-flex items-center gap-2">
            <BellRing className="size-5 text-ice" aria-hidden /> Notifications
          </span>
        </PanelTitle>
        <p className="text-sm text-text-2">Get a heads-up the evening before a likely snow day, and when your district posts an official closure or delay.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={enablePush}>Turn on for this device</Button>
          {devices > 0 && (
            <Button variant="ghost" onClick={testPush}>
              Send a test
            </Button>
          )}
        </div>
        {prefs && (
          <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label htmlFor="ct" className="block text-sm font-medium">
                Closure chance to notify at: <span className="tabular">{prefs.closure_threshold}%</span>
              </label>
              <input id="ct" type="range" min={20} max={95} step={5} value={prefs.closure_threshold} onChange={(e) => setPrefs({ ...prefs, closure_threshold: Number(e.target.value) })} onPointerUp={() => savePrefs(prefs)} onKeyUp={() => savePrefs(prefs)} className="mt-2 w-full accent-[var(--ice)]" />
            </div>
            <div>
              <label htmlFor="st" className="block text-sm font-medium">
                Snow at a saved place: <span className="tabular">{prefs.snow_threshold_in}″ in 24 h</span>
              </label>
              <input id="st" type="range" min={0.5} max={12} step={0.5} value={prefs.snow_threshold_in} onChange={(e) => setPrefs({ ...prefs, snow_threshold_in: Number(e.target.value) })} onPointerUp={() => savePrefs(prefs)} onKeyUp={() => savePrefs(prefs)} className="mt-2 w-full accent-[var(--ice)]" />
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={prefs.notify_official} onChange={(e) => savePrefs({ ...prefs, notify_official: e.target.checked })} className="size-5 accent-[var(--ice)]" />
              Tell me when my district posts an official closure or delay
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={prefs.enabled} onChange={(e) => savePrefs({ ...prefs, enabled: e.target.checked })} className="size-5 accent-[var(--ice)]" />
              Notifications enabled
            </label>
          </form>
        )}
      </Panel>

      <Panel id="calendars">
        <PanelTitle>
          <span className="inline-flex items-center gap-2">
            <CalendarPlus className="size-5 text-violet" aria-hidden /> School calendars
          </span>
        </PanelTitle>
        <p className="text-sm text-text-2">
          Paste your school&apos;s calendar subscription link (it usually ends in .ics) so predictions skip breaks and holidays. Montville Township&apos;s calendar is already built
          in.
        </p>
        {schools.length === 0 ? (
          <p className="mt-4 text-sm text-text-3">
            Save a school first. <Link href="/" className="text-ice underline">Find your school</Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {schools.map((s) => {
              const cal = calendars.find((c) => c.school_id === s.schoolId);
              return (
                <li key={s.schoolId}>
                  <p className="font-medium">{s.name}</p>
                  {cal && <p className="truncate text-sm text-text-3">Using {cal.ics_url}</p>}
                  <div className="mt-2 flex gap-2">
                    <label htmlFor={`ics-${s.schoolId}`} className="sr-only">
                      Calendar link for {s.name}
                    </label>
                    <input
                      id={`ics-${s.schoolId}`}
                      inputMode="url"
                      placeholder="https://…/calendar.ics"
                      value={icsDraft[s.schoolId] ?? ""}
                      onChange={(e) => setIcsDraft({ ...icsDraft, [s.schoolId]: e.target.value })}
                      className="neu-field h-11 min-w-0 flex-1 rounded-2xl px-3.5 text-sm focus:outline-none"
                    />
                    <Button variant="ghost" onClick={() => saveCalendar(s.schoolId)} disabled={!icsDraft[s.schoolId]}>
                      Save
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
