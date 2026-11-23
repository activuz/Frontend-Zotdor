import type { PublicConfig } from "@/api/http";
import { fill, type Dict } from "./i18n";
import { formatDuration, formatRate } from "./format";

/** Answers with config numbers filled in. Answers that need config are dropped when it failed to load. */
export function faqItems(t: Dict, config: PublicConfig | null): { q: string; a: string }[] {
  const values: Record<string, string | number> = config
    ? {
        min: formatDuration(config.min_duration_min, t),
        max: formatDuration(config.max_duration_min, t),
        days: config.max_schedule_ahead_days,
        rate: formatRate(config.commission_rate_bp),
      }
    : {};
  return t.faq.items
    .map((item) => ({ q: item.q, a: fill(item.a, values) }))
    .filter((item) => !/\{[a-zA-Z]+\}/.test(item.a));
}
