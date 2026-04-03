import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "./settings.js";

/**
 * Determine the meta description for a page.
 * No auto-generation. Use explicit values or omit.
 *
 * Priority:
 * 1. Per-content SEO description
 * 2. Page description (excerpt for posts)
 * 3. Settings default description (homepage/archives)
 * 4. null (omit)
 */
export function generateDescription(
  page: PublicPageContext,
  settings: SeoSettings,
): string | null {
  return (
    page.seo?.ogDescription ||
    page.description ||
    settings.defaultDescription ||
    null
  );
}
