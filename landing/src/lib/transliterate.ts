/**
 * Uzbek Latin → Cyrillic transliteration for the landing copy.
 *
 * Words wrapped in **double asterisks** (brand names, domains) and {placeholders} are kept as is.
 * Accepts the official ʻ (U+02BB) and ʼ (U+02BC) as well as the ASCII look-alikes.
 */

const TURNED = "[ʻ'`‘’]";

const MAP: [RegExp, string][] = [
  [new RegExp(`O${TURNED}`, "g"), "Ў"],
  [new RegExp(`o${TURNED}`, "g"), "ў"],
  [new RegExp(`G${TURNED}`, "g"), "Ғ"],
  [new RegExp(`g${TURNED}`, "g"), "ғ"],
  [/SH/g, "Ш"],
  [/Sh/g, "Ш"],
  [/sh/g, "ш"],
  [/CH/g, "Ч"],
  [/Ch/g, "Ч"],
  [/ch/g, "ч"],
  [/YO/g, "Ё"],
  [/Yo/g, "Ё"],
  [/yo/g, "ё"],
  [/YU/g, "Ю"],
  [/Yu/g, "Ю"],
  [/yu/g, "ю"],
  [/YA/g, "Я"],
  [/Ya/g, "Я"],
  [/ya/g, "я"],
  [/YE/g, "Е"],
  [/Ye/g, "Е"],
  [/ye/g, "е"],
  // A word-initial "e" is "э" in Cyrillic: eʼlon → эълон, echki → эчки.
  [/(^|[^A-Za-zʻʼ'`‘’])E/g, "$1Э"],
  [/(^|[^A-Za-zʻʼ'`‘’])e/g, "$1э"],
  [/A/g, "А"],
  [/a/g, "а"],
  [/B/g, "Б"],
  [/b/g, "б"],
  [/D/g, "Д"],
  [/d/g, "д"],
  [/E/g, "Е"],
  [/e/g, "е"],
  [/F/g, "Ф"],
  [/f/g, "ф"],
  [/G/g, "Г"],
  [/g/g, "г"],
  [/H/g, "Ҳ"],
  [/h/g, "ҳ"],
  [/I/g, "И"],
  [/i/g, "и"],
  [/J/g, "Ж"],
  [/j/g, "ж"],
  [/K/g, "К"],
  [/k/g, "к"],
  [/L/g, "Л"],
  [/l/g, "л"],
  [/M/g, "М"],
  [/m/g, "м"],
  [/N/g, "Н"],
  [/n/g, "н"],
  [/O/g, "О"],
  [/o/g, "о"],
  [/P/g, "П"],
  [/p/g, "п"],
  [/Q/g, "Қ"],
  [/q/g, "қ"],
  [/R/g, "Р"],
  [/r/g, "р"],
  [/S/g, "С"],
  [/s/g, "с"],
  [/T/g, "Т"],
  [/t/g, "т"],
  [/U/g, "У"],
  [/u/g, "у"],
  [/V/g, "В"],
  [/v/g, "в"],
  [/X/g, "Х"],
  [/x/g, "х"],
  [/Y/g, "Й"],
  [/y/g, "й"],
  [/Z/g, "З"],
  [/z/g, "з"],
  [/[ʼ'`’]/g, "ъ"],
];

const KEEP = /\*\*([^*]+)\*\*|\{[a-zA-Z]+\}/g;

export function toCyrillic(text: string): string {
  if (!text) return text;
  const kept: string[] = [];
  let result = text.replace(KEEP, (match, word: string | undefined) => {
    kept.push(word ?? match);
    return `\u0000${kept.length - 1}\u0000`;
  });
  for (const [pattern, replacement] of MAP) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)]);
}

/** Drops the ** markers for the Latin and English views. */
export function stripMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** Applies `fn` to every string inside nested objects and arrays; other values pass through. */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => mapStrings(v, fn)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}
