import type { PublicPageContext } from "emdash";

const SNIPPET_DIRECTIVES = "max-snippet:-1, max-image-preview:large, max-video-preview:-1";

const NOINDEX_PATHS = new Set(["/search"]);

/**
 * Generate meta robots value.
 * 
 * - Normal pages: index, follow + snippet directives
 * - Noindex pages: noindex, follow + snippet directives
 * - 404/error: omit entirely (return null)
 */
export function generateRobots(page: PublicPageContext): string | null {
  const path = page.path || "/";

  // 404: omit robots entirely
  if (path === "/404") return null;

  // Check for noindex: explicit setting or known noindex paths
  const explicitRobots = page.seo?.robots || "";
  const isNoindex =
    explicitRobots.includes("noindex") || NOINDEX_PATHS.has(path);

  if (isNoindex) {
    return `noindex, follow, ${SNIPPET_DIRECTIVES}`;
  }

  return `index, follow, ${SNIPPET_DIRECTIVES}`;
}
