const TZ = "America/Argentina/Buenos_Aires";

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function nowTime() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}
export function addDays(day: string, days: number) {
  const d = new Date(day.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to.slice(0, 10) + "T12:00:00Z") - Date.parse(from.slice(0, 10) + "T12:00:00Z")) / 86_400_000);
}
export function monthStart(day: string) { return day.slice(0, 8) + "01"; }
export function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function monthLabel(month: string) { return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`; }
export function greeting() {
  const h = Number(nowTime().slice(0, 2));
  return h >= 5 && h < 13 ? "Buen día" : h >= 13 && h < 20 ? "Buenas tardes" : "Buenas noches";
}
export const fmt = (v: number | null, digits = 1) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(digits).replace(".", ","));
