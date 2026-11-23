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
  if (diffDays === -1) return `Ertaga ${time}`;
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${year} ${time}`;
}

/** "12-dekabr 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Digits grouped for labels: 25000000 -> "25 000 000". */
export function groupDigits(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
}

/** Remaining time: "02:14:05", or "3 kun 02:14:05" when longer than a day. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days} kun ${clock}` : clock;
}

/** "45 daqiqa", "2 soat", "1 soat 30 daqiqa". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} daqiqa`;
  return m === 0 ? `${h} soat` : `${h} soat ${m} daqiqa`;
}

export function formatKm(km: number | null | undefined): string | null {
  if (km === null || km === undefined) return null;
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

/** 4.66 -> "4,7" */
export function formatRating(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(1).replace('.', ',');
}
