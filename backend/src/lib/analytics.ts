import { manilaToday } from "./manila-date.js";

// Coordinator analytics (API_CONTRACT_V1.md §13). Everything here is computed
// from stored records; nothing is estimated. Dates are Asia/Manila calendar
// dates ("YYYY-MM-DD"), the same as Booking.scheduledDate.

export type DateRange = { from: string; to: string };

export const MAX_RANGE_DAYS = 366;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" → midnight UTC of that calendar day, or null if it is not a real date.
function parseDay(value: string): number | null {
  if (!DATE_PATTERN.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return time;
}

function formatDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return formatDay(parseDay(date)! + days * DAY_MS);
}

// Days from [from] to [to], both included.
function inclusiveDays(from: string, to: string) {
  return Math.round((parseDay(to)! - parseDay(from)!) / DAY_MS) + 1;
}

// Without a range: the first day of the month five months back, through today (six months).
export function defaultRange(now = new Date()): DateRange {
  const to = manilaToday(now);
  const [year, month] = to.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - 5, 1));
  return { from: formatDay(start.getTime()), to };
}

export type RangeError = { field: "from" | "to"; message: string };

export function parseRange(query: { from?: unknown; to?: unknown }, now = new Date()): DateRange | RangeError {
  if (query.from === undefined && query.to === undefined) return defaultRange(now);
  const fallback = defaultRange(now);
  const from = query.from ?? fallback.from;
  const to = query.to ?? fallback.to;
  if (typeof from !== "string" || parseDay(from) === null) return { field: "from", message: "from must be a date (YYYY-MM-DD)." };
  if (typeof to !== "string" || parseDay(to) === null) return { field: "to", message: "to must be a date (YYYY-MM-DD)." };
  if (from > to) return { field: "from", message: "from must not be after to." };
  if (inclusiveDays(from, to) > MAX_RANGE_DAYS) return { field: "to", message: `The range can be at most ${MAX_RANGE_DAYS} days.` };
  return { from, to };
}

// The instants a range covers: Manila midnight of [from] up to (not including)
// Manila midnight after [to]. Manila has no daylight saving, so +08:00 is exact.
export function rangeInstants({ from, to }: DateRange) {
  return { start: new Date(`${from}T00:00:00+08:00`), end: new Date(`${addDays(to, 1)}T00:00:00+08:00`) };
}

// "YYYY-MM" for every month the range touches, in order.
export function monthsIn({ from, to }: DateRange) {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) return months;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value);
}

const minutesBetween = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 60_000;

// Rows as loaded by the route.
export type CompletedTrekRow = {
  scheduledDate: string;
  packagePrice: number;
  trailId: string;
  guideId: string | null;
  participants: { kind: string; attendance: string | null }[];
};
export type IncidentRow = { status: string; createdAt: Date; acknowledgedAt: Date | null; resolvedAt: Date | null };
export type RestrictionRow = { trailId: string; startDate: string; endDate: string; liftedAt: Date | null };
export type TrailRow = { id: string; name: string; isActive: boolean };
export type GuideRow = { id: string; fullName: string };

export type AnalyticsInput = {
  range: DateRange;
  trails: TrailRow[];
  guides: GuideRow[];
  completedTreks: CompletedTrekRow[];
  bookingsByStatus: { status: string; count: number }[];
  incidents: IncidentRow[];
  restrictions: RestrictionRow[];
};

// Days a closure kept its trail closed inside the range. A lifted closure
// stops counting from the Manila day it was lifted.
function closureDays(restriction: RestrictionRow, range: DateRange) {
  let end = restriction.endDate;
  if (restriction.liftedAt) {
    const lastClosedDay = addDays(manilaToday(restriction.liftedAt), -1);
    if (lastClosedDay < end) end = lastClosedDay;
  }
  const start = restriction.startDate > range.from ? restriction.startDate : range.from;
  if (end > range.to) end = range.to;
  return start > end ? 0 : inclusiveDays(start, end);
}

export function buildAnalytics(input: AnalyticsInput) {
  const { range } = input;
  const months = monthsIn(range);

  // A visitor went on a completed trek: not marked absent (walk-ins included),
  // the same rule used for certificates.
  const visitorsOf = (trek: CompletedTrekRow) => trek.participants.filter((p) => p.attendance !== "ABSENT");

  // Retired trails only appear when they have something to show.
  const usedTrailIds = new Set([...input.completedTreks.map((t) => t.trailId), ...input.restrictions.map((r) => r.trailId)]);
  const trails = input.trails.filter((trail) => trail.isActive || usedTrailIds.has(trail.id));

  const visitorsByMonth = new Map(months.map((month) => [month, new Map(trails.map((trail) => [trail.id, 0]))]));
  const valueByMonth = new Map(months.map((month) => [month, 0]));
  const perTrail = new Map(trails.map((trail) => [trail.id, { completedTreks: 0, visitors: 0 }]));
  const perGuide = new Map(input.guides.map((guide) => [guide.id, 0]));
  let visitors = 0;
  let walkIns = 0;

  for (const trek of input.completedTreks) {
    const went = visitorsOf(trek);
    const month = trek.scheduledDate.slice(0, 7);
    visitors += went.length;
    walkIns += went.filter((p) => p.kind === "WALK_IN").length;

    const byTrail = visitorsByMonth.get(month);
    if (byTrail?.has(trek.trailId)) byTrail.set(trek.trailId, byTrail.get(trek.trailId)! + went.length);
    if (valueByMonth.has(month)) valueByMonth.set(month, valueByMonth.get(month)! + trek.packagePrice);

    const trail = perTrail.get(trek.trailId);
    if (trail) {
      trail.completedTreks += 1;
      trail.visitors += went.length;
    }
    if (trek.guideId && perGuide.has(trek.guideId)) perGuide.set(trek.guideId, perGuide.get(trek.guideId)! + 1);
  }

  const acknowledged = input.incidents.filter((i) => i.acknowledgedAt).map((i) => minutesBetween(i.createdAt, i.acknowledgedAt!));
  const resolved = input.incidents.filter((i) => i.resolvedAt).map((i) => minutesBetween(i.createdAt, i.resolvedAt!));
  const closedDays = new Map(trails.map((trail) => [trail.id, 0]));
  for (const restriction of input.restrictions) {
    if (closedDays.has(restriction.trailId)) {
      closedDays.set(restriction.trailId, closedDays.get(restriction.trailId)! + closureDays(restriction, range));
    }
  }

  const bookingsByStatus: Record<string, number> = {};
  for (const { status, count } of input.bookingsByStatus) bookingsByStatus[status] = count;

  return {
    range,
    months,
    trails: trails.map((trail) => {
      const stats = perTrail.get(trail.id)!;
      return {
        id: trail.id,
        name: trail.name,
        completedTreks: stats.completedTreks,
        visitors: stats.visitors,
        averageGroupSize: stats.completedTreks ? Math.round((stats.visitors / stats.completedTreks) * 10) / 10 : null,
      };
    }),
    visitors: {
      total: visitors,
      walkIns,
      byMonth: months.map((month) => ({ month, byTrail: Object.fromEntries(visitorsByMonth.get(month)!) })),
    },
    completedTreks: input.completedTreks.length,
    bookingsByStatus,
    guides: input.guides
      .map((guide) => ({ id: guide.id, fullName: guide.fullName, completedTreks: perGuide.get(guide.id)! }))
      .sort((a, b) => b.completedTreks - a.completedTreks || a.fullName.localeCompare(b.fullName)),
    safety: {
      incidents: input.incidents.length,
      openIncidents: input.incidents.filter((i) => i.status !== "RESOLVED").length,
      medianMinutesToAcknowledge: median(acknowledged),
      medianMinutesToResolve: median(resolved),
      closureDaysByTrail: trails.map((trail) => ({ trailId: trail.id, name: trail.name, days: closedDays.get(trail.id)! })),
    },
    // Package prices of completed treks. GCash runs in test mode, so this is
    // what was booked, not money TrailSync has received.
    bookedValue: {
      testMode: true,
      total: [...valueByMonth.values()].reduce((sum, amount) => sum + amount, 0),
      byMonth: months.map((month) => ({ month, amount: valueByMonth.get(month)! })),
    },
  };
}

export type Analytics = ReturnType<typeof buildAnalytics>;
