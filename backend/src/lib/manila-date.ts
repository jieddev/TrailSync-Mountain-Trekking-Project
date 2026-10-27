// Bookings are scheduled on Asia/Manila calendar dates ("YYYY-MM-DD"), whatever
// timezone the server runs in. en-CA formats dates as YYYY-MM-DD.
const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

export function manilaToday(now = new Date()) {
  return manilaDate.format(now);
}

const manilaLong = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });

// "October 26, 2026" on the Asia/Manila calendar.
export function manilaLongDate(date: Date) {
  return manilaLong.format(date);
}
