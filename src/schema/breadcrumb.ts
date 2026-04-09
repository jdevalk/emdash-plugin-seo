import type { BreadcrumbItem } from "@jdevalk/seo-graph-core";
import type { PublicPageContext } from "emdash";
import type { BreadcrumbRule, SeoSettings } from "../settings.js";

/**
 * Compute the breadcrumb item list for a page, or `null` when no
 * breadcrumb should be emitted (homepage, 404, single-item trails).
 *
 * Priority order:
 *   1. Per-`pageType` rule match (from `settings.breadcrumbRules`)
 *   2. Path derivation from `page.path`, with segment label overrides
 *      from `settings.breadcrumbLabels`
 *
 * Trails are always absolute URLs (prefixed with `siteUrl`) and always
 * start with a `Home` crumb.
 */
export function buildBreadcrumbs(
  page: PublicPageContext,
  settings: SeoSettings,
  siteUrl: string,
): BreadcrumbItem[] | null {
  // Homepage and 404 never emit breadcrumbs — single-item trails
  // provide no value and crawlers don't want them.
  const path = page.path || "/";
  if (path === "/" || path === "/404") return null;

  const baseUrl = siteUrl.replace(/\/$/, "");
  const pageUrl = page.canonical || page.url;

  // Layer 1: rule match by pageType
  const rule = settings.breadcrumbRules[page.pageType];
  if (rule && rule.length > 0) {
    return applyRule(rule, page, baseUrl, pageUrl);
  }

  // Layer 2: path derivation with label map
  return derivePath(page, settings, baseUrl, pageUrl);
}

function applyRule(
  rule: BreadcrumbRule,
  page: PublicPageContext,
  baseUrl: string,
  pageUrl: string,
): BreadcrumbItem[] | null {
  const items: BreadcrumbItem[] = [];
  for (const crumb of rule) {
    const name = crumb.label === "{title}" ? page.title || "" : crumb.label;
    const href = resolveHref(crumb.href, baseUrl, pageUrl);
    items.push({ name, url: href });
  }
  return items.length > 1 ? items : null;
}

/**
 * Resolve a rule's `href` placeholder or relative URL to an absolute one.
 * - Undefined or `{path}` → current page URL
 * - Starts with `/` → prefixed with siteUrl
 * - Anything else → returned as-is (assumed already absolute)
 */
function resolveHref(href: string | undefined, baseUrl: string, pageUrl: string): string {
  if (!href || href === "{path}") return pageUrl;
  if (href.startsWith("/")) return `${baseUrl}${href}`;
  return href;
}

function derivePath(
  page: PublicPageContext,
  settings: SeoSettings,
  baseUrl: string,
  pageUrl: string,
): BreadcrumbItem[] | null {
  const items: BreadcrumbItem[] = [{ name: "Home", url: `${baseUrl}/` }];

  // Strip leading/trailing slashes and split.
  const trimmed = (page.path || "").replace(/^\/+|\/+$/g, "");
  if (!trimmed) return null;

  const segments = trimmed.split("/");
  let accumulated = "";
  const hasTrailingSlash = (page.path || "").endsWith("/");

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    accumulated += `/${segment}`;

    if (shouldSkipSegment(segment, segments, i)) {
      continue;
    }

    const isLast = i === segments.length - 1;
    // Last crumb uses page.title if present (authoritative); earlier
    // crumbs come from the label map or default cleaning.
    const label = isLast && page.title
      ? page.title
      : settings.breadcrumbLabels[segment] || defaultCleanSegment(segment);

    // For the last crumb, use the canonical URL so fragment/query
    // normalization from the canonical plugin is preserved. For
    // intermediate crumbs, build the absolute URL from the segment.
    const url = isLast
      ? pageUrl
      : `${baseUrl}${accumulated}${hasTrailingSlash ? "/" : ""}`;

    items.push({ name: label, url });
  }

  return items.length > 1 ? items : null;
}

/**
 * Noise segments that should not appear as crumbs:
 *   - `/YYYY/` or `/MM/` — year/month archive segments
 *   - `/page/N` pagination — both the literal `page` and the number
 *
 * When a segment is skipped, subsequent crumbs still accumulate the
 * URL correctly (so `/blog/2025/my-post` → `Home > Blog > My Post`
 * with the last crumb pointing at the full canonical path).
 */
function shouldSkipSegment(segment: string, all: string[], index: number): boolean {
  // /.../page/N — both segments
  if (segment === "page" && index < all.length - 1 && /^\d+$/.test(all[index + 1])) {
    return true;
  }
  if (index > 0 && all[index - 1] === "page" && /^\d+$/.test(segment)) {
    return true;
  }

  // Pure numeric year (4 digits) or month (1-2 digits) archive segments
  if (/^\d{4}$/.test(segment)) return true;
  if (/^\d{1,2}$/.test(segment)) return true;

  return false;
}

/**
 * Default segment cleaner: replace dashes/underscores with spaces and
 * title-case the result. `"open-source"` → `"Open Source"`.
 */
function defaultCleanSegment(segment: string): string {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
