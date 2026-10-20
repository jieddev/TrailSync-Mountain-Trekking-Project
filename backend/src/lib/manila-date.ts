// Bookings are scheduled on Asia/Manila calendar dates ("YYYY-MM-DD"), whatever
// timezone the server runs in. en-CA formats dates as YYYY-MM-DD.
const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

export function manilaToday(now = new Date()) {
  return manilaDate.format(now);
}
