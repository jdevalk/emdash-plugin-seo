import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "./settings.js";

/**
 * Extract the raw page title (without site name suffix).
 * Base.astro constructs: `${title} — ${siteTitle}`
 */
function extractRawTitle(page: PublicPageContext, settings: SeoSettings): string {
  const fullTitle = page.title || "";
  const siteName = page.siteName || "";
  const sep = settings.separator;

  if (siteName && fullTitle.includes(sep + siteName)) {
    return fullTitle.split(sep + siteName)[0].trim();
  }
  if (siteName && fullTitle.endsWith(siteName)) {
    return fullTitle.slice(0, -siteName.length).trim();
  }
  return fullTitle;
}

/**
 * Detect pagination from URL query string.
 */
function getPageNumber(url: string): number | null {
  try {
    const u = new URL(url, "https://placeholder.local");
    const page = u.searchParams.get("page");
    if (page && Number(page) > 1) return Number(page);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Generate the OG title for a page.
 * og:title should be just the page title, not including site name.
 */
export function generateOgTitle(page: PublicPageContext, settings: SeoSettings): string {
  const path = page.path || "/";
  const pageNum = getPageNumber(page.url);
  let title: string;

  if (path === "/") {
    title = page.siteName || extractRawTitle(page, settings);
  } else if (path === "/404") {
    title = "Page not found";
  } else {
    title = extractRawTitle(page, settings) || page.siteName || "";
  }

  if (pageNum) {
    title += ` - Page ${pageNum}`;
  }

  return title;
}
