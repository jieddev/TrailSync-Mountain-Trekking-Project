// A hiker's name as entered at sign-up. Middle name and suffix are optional.
export type NameParts = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
};

export const NAME_PART_MAX_LENGTH = 50;
export const SUFFIX_MAX_LENGTH = 10;

// Trims and collapses inner spaces; a blank part becomes null.
export function cleanNamePart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

// "Juan Santos Dela Cruz Jr.": the parts that are present, in order.
export function composeFullName(parts: NameParts): string {
  return [parts.firstName, parts.middleName, parts.lastName, parts.suffix]
    .map(cleanNamePart)
    .filter((part): part is string => part !== null)
    .join(" ");
}

// Reads the name parts from a request body. Returns an error message for the first bad part.
export function parseNameParts(body: Record<string, unknown>): { parts: NameParts } | { error: string } {
  const firstName = cleanNamePart(body.firstName);
  const middleName = cleanNamePart(body.middleName);
  const lastName = cleanNamePart(body.lastName);
  const suffix = cleanNamePart(body.suffix);

  for (const [field, value] of [["middleName", body.middleName], ["suffix", body.suffix]] as const) {
    if (value !== undefined && value !== null && typeof value !== "string") {
      return { error: `${field} must be a string when given.` };
    }
  }
  if (!firstName) return { error: "firstName is required and must be a non-empty string." };
  if (!lastName) return { error: "lastName is required and must be a non-empty string." };
  for (const [field, value, max] of [
    ["firstName", firstName, NAME_PART_MAX_LENGTH],
    ["middleName", middleName, NAME_PART_MAX_LENGTH],
    ["lastName", lastName, NAME_PART_MAX_LENGTH],
    ["suffix", suffix, SUFFIX_MAX_LENGTH],
  ] as const) {
    if (value && value.length > max) return { error: `${field} must be at most ${max} characters.` };
  }

  return { parts: { firstName, middleName, lastName, suffix } };
}
