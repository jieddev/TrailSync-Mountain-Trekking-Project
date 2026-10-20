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
