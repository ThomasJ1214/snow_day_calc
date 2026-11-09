import { z } from "zod";

/** U.S. states, DC and territories lie within these bounds. */
export const latSchema = z.coerce.number().min(13).max(72);
export const lonSchema = z.coerce.number().min(-180).max(-64);
export const coordsSchema = z.object({ lat: latSchema, lon: lonSchema });
export const querySchema = z.string().trim().min(2).max(120);
export const stateSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
export const zipSchema = z.string().trim().regex(/^\d{5}$/);
export const schoolIdSchema = z.string().regex(/^(pub|pvt)-[A-Za-z0-9]{6,14}$/);
export const leaidSchema = z.string().regex(/^\d{7}$/);
