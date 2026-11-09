/** Snowfall color scale (inches), icy blues → violet → magenta; shared by map legend and overlays. */
export const SNOW_SCALE: { min: number; label: string; rgba: [number, number, number, number] }[] = [
  { min: 0.1, label: "0.1″", rgba: [186, 230, 253, 150] },
  { min: 1, label: "1″", rgba: [125, 211, 252, 175] },
  { min: 2, label: "2″", rgba: [56, 189, 248, 190] },
  { min: 4, label: "4″", rgba: [59, 130, 246, 200] },
  { min: 6, label: "6″", rgba: [99, 102, 241, 210] },
  { min: 8, label: "8″", rgba: [139, 92, 246, 215] },
  { min: 12, label: "12″", rgba: [168, 85, 247, 225] },
  { min: 18, label: "18″", rgba: [217, 70, 239, 230] },
  { min: 24, label: "24″+", rgba: [244, 114, 182, 235] },
];

export function snowColor(inches: number): [number, number, number, number] {
  let c: [number, number, number, number] = [0, 0, 0, 0];
  for (const s of SNOW_SCALE) if (inches >= s.min) c = s.rgba;
  return c;
}

