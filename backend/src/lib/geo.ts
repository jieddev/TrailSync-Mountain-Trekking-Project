import type { ErrorDetail } from "./http-errors.js";

export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Checks a GPS fix's coordinates. [prefix] names the fix in error fields,
// e.g. "points[3]." for one fix in a batch.
export function coordinateDetails(latitude: unknown, longitude: unknown, prefix = ""): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  if (!finite(latitude) || latitude < -90 || latitude > 90) {
    details.push({ field: `${prefix}latitude`, code: "INVALID_LOCATION", message: "Latitude must be between -90 and 90." });
  }
  if (!finite(longitude) || longitude < -180 || longitude > 180) {
    details.push({ field: `${prefix}longitude`, code: "INVALID_LOCATION", message: "Longitude must be between -180 and 180." });
  }
  return details;
}

// Checks an optional fix accuracy in metres.
export function accuracyDetails(accuracyM: unknown, prefix = ""): ErrorDetail[] {
  if (accuracyM === undefined || accuracyM === null || (finite(accuracyM) && accuracyM >= 0)) return [];
  return [{ field: `${prefix}accuracyM`, code: "INVALID_LOCATION", message: "Accuracy must be zero or more metres." }];
}
