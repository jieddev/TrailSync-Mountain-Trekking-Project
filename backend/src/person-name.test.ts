import { describe, expect, it } from "vitest";

import { cleanNamePart, composeFullName, parseNameParts } from "./lib/person-name.js";

describe("composeFullName", () => {
  it("joins every part in order", () => {
    expect(composeFullName({ firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz", suffix: "Jr." })).toBe("Juan Santos Dela Cruz Jr.");
  });

  it("skips a missing middle name and suffix", () => {
    expect(composeFullName({ firstName: "Maria Clara", middleName: null, lastName: "Reyes", suffix: null })).toBe("Maria Clara Reyes");
  });

  it("collapses extra spaces", () => {
    expect(composeFullName({ firstName: " Juan ", middleName: "  ", lastName: "De  los   Santos", suffix: "III" })).toBe("Juan De los Santos III");
  });
});

describe("cleanNamePart", () => {
  it.each([[undefined], [null], [""], ["   "], [5]])("treats %j as no value", (value) => {
    expect(cleanNamePart(value)).toBeNull();
  });
});

describe("parseNameParts", () => {
  it("accepts a name at the length limits", () => {
    expect(parseNameParts({ firstName: "J".repeat(50), lastName: "C".repeat(50), suffix: "S".repeat(10) })).toEqual({
      parts: { firstName: "J".repeat(50), middleName: null, lastName: "C".repeat(50), suffix: "S".repeat(10) },
    });
  });

  it("rejects an over-long middle name", () => {
    expect(parseNameParts({ firstName: "Juan", middleName: "M".repeat(51), lastName: "Cruz" })).toEqual({
      error: "middleName must be at most 50 characters.",
    });
  });
});
