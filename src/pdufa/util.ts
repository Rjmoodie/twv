// ────────────────────────────────────────────────────────────────────────────────
// util.ts
// ────────────────────────────────────────────────────────────────────────────────
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import CryptoJS from "crypto-js";
import { ISODate, Item, IngestContext } from "./types";

export function sha1(s: string) {
  return CryptoJS.SHA1(s).toString();
}

/**
 * Stable content-based ID for deduplication across sources.
 * Intentionally excludes `source` so that the same event reported by
 * multiple sources lands in the same bucket and receives a corroboration
 * confidence bonus in mergeAndScore.
 */
export function stableId(it: Partial<Item>) {
  return sha1(`${it.url}|${it.eventDate ?? ""}|${it.headline}`);
}

export function asISO(d?: Date | string | null): ISODate | undefined {
  if (!d) return undefined;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString().slice(0, 10);
}

// CORS proxy for development (you can replace with your own proxy)
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function getProxiedUrl(url: string): string {
  // In development, use CORS proxy
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return CORS_PROXY + encodeURIComponent(url);
  }
  return url;
}

export function html(url: string, ctx: IngestContext) {
  const proxiedUrl = getProxiedUrl(url);
  return (ctx.fetcher ?? fetch)(proxiedUrl, {
    headers: { "user-agent": ctx.userAgent ?? "somatech-pdufa/1.0" },
  }).then((r) => r.text());
}

export function json<T = any>(url: string, ctx: IngestContext) {
  const proxiedUrl = getProxiedUrl(url);
  return (ctx.fetcher ?? fetch)(proxiedUrl, {
    headers: { "user-agent": ctx.userAgent ?? "somatech-pdufa/1.0" },
  }).then((r) => r.json() as Promise<T>);
}

export function rss(url: string, ctx: IngestContext) {
  const proxiedUrl = getProxiedUrl(url);
  return (ctx.fetcher ?? fetch)(proxiedUrl, {
    headers: { "user-agent": ctx.userAgent ?? "somatech-pdufa/1.0" },
  })
    .then((r) => r.text())
    .then((txt) => {
      const parser = new XMLParser({ ignoreAttributes: false });
      return parser.parse(txt);
    });
}

export const MAJOR_AMENDMENT_PATTERNS = [
  /major amendment/i,
  /pdufa (?:goal )?date extended/i,
  /(extend|extension) (?:the )?pdufa/i,
  /additional (?:three|3) months/i,
];

export const CRL_PATTERNS = [/complete response/i, /crl/i];
export const APPROVAL_PATTERNS = [/approval/i, /approves/i, /approved/i, /licensed?/i];

export function sniffDecision(headline: string): "pdufa" | "adcom" | "approval" | "crl" | "other" {
  const h = headline.toLowerCase();
  if (CRL_PATTERNS.some((p) => p.test(h))) return "crl";
  if (APPROVAL_PATTERNS.some((p) => p.test(h))) return "approval";
  // if it mentions advisory/committee/meeting
  if (/advisory|adcom|committee/.test(h)) return "adcom";
  if (/pdufa|target action/i.test(h)) return "pdufa";
  return "other";
}
