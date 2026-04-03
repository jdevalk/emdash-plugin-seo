import type { PublicPageContext } from "emdash";

const NOINDEX_PATHS = new Set(["/search"]);

/**
 * Generate canonical URL.
 * 
 * - Every indexable page gets one
 * - Omit on 404 and noindex pages
 * - Absolute, clean, with trailing slash
 * - Respect user override
 * - Include pagination parameter
 */
export function generateCanonical(
  page: PublicPageContext,
  siteUrl: string,
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

    // Ensure trailing slash
    if (!pathname.endsWith("/")) pathname += "/";

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
