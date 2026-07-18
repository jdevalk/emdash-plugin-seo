import type { PublicPageContext } from "emdash";
import { applyTrailingSlash, type TrailingSlash } from "./urls.js";

const NOINDEX_PATHS = new Set(["/search"]);

/**
 * Generate canonical URL.
 *
 * - Every indexable page gets one
 * - Omit on 404 and noindex pages
 * - Absolute, clean, with the site's trailing-slash policy (`trailingSlash`,
 *   from Astro's config — shared with `buildPageUrl` so canonical and
 *   hreflang/sitemap URLs stay identical)
 * - Respect user override
 * - Include pagination parameter
 */
export function generateCanonical(
  page: PublicPageContext,
  siteUrl: string,
  trailingSlash?: TrailingSlash,
): string | null {
  const path = page.path || "/";

  // No canonical for 404 or noindex pages
  if (path === "/404") return null;
  if (page.seo?.robots?.includes("noindex")) return null;
  if (NOINDEX_PATHS.has(path)) return null;

  // User override
  if (page.canonical) return page.canonical;

  // Build from page URL
  try {
    const u = new URL(page.url, siteUrl);
    let pathname = u.pathname.toLowerCase().replace(/\/+/g, "/");

    // Apply the site's trailing-slash policy (default: keep a trailing slash).
    pathname = applyTrailingSlash(pathname, trailingSlash);

    // Build clean URL with only pagination param
    const pageParam = u.searchParams.get("page");
    let canonical = `${siteUrl.replace(/\/$/, "")}${pathname}`;
    if (pageParam && Number(pageParam) > 1) {
      canonical += `?page=${pageParam}`;
    }

    return canonical;
  } catch {
    return null;
  }
}
