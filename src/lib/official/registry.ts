import registry from "./registry.json";
import type { RegistryEntry } from "./status";

const data = registry as unknown as { generatedAt: string | null; districts: RegistryEntry[] };
const entries = data.districts;
const byLeaid = new Map(entries.map((e) => [e.leaid, e]));

export function getRegistryEntry(leaid: string | null | undefined): RegistryEntry | null {
  if (!leaid) return null;
  return byLeaid.get(leaid) ?? null;
}

export function registryDistricts(): RegistryEntry[] {
  return entries;
}

export const registryMeta = {
  generatedAt: data.generatedAt,
  count: entries.length,
};
