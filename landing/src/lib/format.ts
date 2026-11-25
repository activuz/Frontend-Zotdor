/** Formatting rules from docs/DESIGN.md §3, same as frontend/src/lib/format.ts. */

import { fill, type Dict } from "./i18n";

const NARROW_NBSP = " ";

/** 23500000 → "23 500 000" */
export function groupDigits(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
}

/** 23500000 → "23 500 000 soʻm" */
export function formatSom(amount: number, t: Dict): string {
  return `${groupDigits(amount)}${NARROW_NBSP}${t.units.som}`;
}

/** Same rule as the backend and frontend: ceil(amount × bp / 10 000) (BR-40). */
export function commissionFor(amount: number, rateBp: number): number {
  if (amount <= 0) return 0;
  return Math.ceil((amount * rateBp) / 10_000);
}

/** 20 → "0.2%" */
export function formatRate(rateBp: number): string {
  return `${(rateBp / 100).toString()}%`;
}

/** 10 → "10 daqiqa", 720 → "12 soat" */
export function formatDuration(minutes: number, t: Dict): string {
  if (minutes >= 60 && minutes % 60 === 0) return fill(t.units.hours, { n: minutes / 60 });
  return fill(t.units.minutes, { n: minutes });
}

const TASHKENT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "23-noyabr 18:30" in Tashkent time, identical on the server and in the browser. */
export function formatDateTime(iso: string, t: Dict): string {
  const parts = Object.fromEntries(TASHKENT.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const month = t.units.months[Number(parts.month) - 1] ?? "";
  return `${parts.day}-${month} ${parts.hour}:${parts.minute}`;
}
