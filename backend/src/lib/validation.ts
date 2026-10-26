// Field checks shared by routes that accept participant details.
export function validAge(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

export function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Optional email: absent or blank is fine, anything else must look like an address.
export function validOptionalEmail(value: unknown): boolean {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) return true;
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// The trimmed email, or null when none was given.
export function optionalEmail(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
