import { describe, expect, it } from "vitest";

import { manilaLongDate, manilaToday } from "./lib/manila-date.js";

describe("manilaToday", () => {
  it("uses the Asia/Manila calendar date (UTC+8), not the server's", () => {
    expect(manilaToday(new Date("2026-10-20T00:30:00Z"))).toBe("2026-10-20");
    expect(manilaToday(new Date("2026-10-20T15:59:59Z"))).toBe("2026-10-20");
    expect(manilaToday(new Date("2026-10-20T16:00:00Z"))).toBe("2026-10-21");
    expect(manilaToday(new Date("2026-12-31T16:30:00Z"))).toBe("2027-01-01");
  });
});

describe("manilaLongDate", () => {
  it("spells out the Asia/Manila date", () => {
    expect(manilaLongDate(new Date("2026-10-26T03:00:00Z"))).toBe("October 26, 2026");
    expect(manilaLongDate(new Date("2026-12-31T16:30:00Z"))).toBe("January 1, 2027");
  });
});
