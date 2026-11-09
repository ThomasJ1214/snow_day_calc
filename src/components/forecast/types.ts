// Client-side mirrors of server payloads (type-only imports keep server code out of the bundle).
export type { LocationForecast, SourceStatus } from "@/lib/forecast/service";
export type { SchoolPrediction } from "@/lib/forecast/school";
export type { HourPoint, SnowAnalysis, WindowKey } from "@/lib/snow/analyze";
