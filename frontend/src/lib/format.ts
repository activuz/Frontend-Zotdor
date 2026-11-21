/** Formatting rules from docs/DESIGN.md §3. Independent of the browser locale on purpose. */

const NARROW_NBSP = ' ';

/** 23500000 -> "23 500 000 soʻm" (narrow no-break spaces, never "UZS"). */
export function formatSom(amount: number, { signed = false } = {}): string {
  const sign = amount < 0 ? '−' : signed && amount > 0 ? '+' : '';
  const digits = Math.abs(Math.trunc(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
  return `${sign}${digits}${NARROW_NBSP}soʻm`;
}

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "Bugun 18:30", "Kecha 09:05", "12-dekabr 14:00". */
export function formatDateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (diffDays === 0) return `Bugun ${time}`;
  if (diffDays === 1) return `Kecha ${time}`;
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${year} ${time}`;
}

/** "12-dekabr 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
