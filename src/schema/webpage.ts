import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { PublicPageContext } from "emdash";

const COLLECTION_PAGE_PATHS = new Set(["/", "/posts", "/posts/", "/videos", "/videos/"]);

/**
 * Determine the WebPage @type based on the page path.
 */
function getWebPageType(page: PublicPageContext): string {
  const path = page.path || "/";

  if (COLLECTION_PAGE_PATHS.has(path)) return "CollectionPage";
  if (path.startsWith("/categories/")) return "CollectionPage";
  if (path.startsWith("/tags/")) return "CollectionPage";

  return "WebPage";
}

/**
 * Build the WebPage schema node.
 * Every page includes a WebPage node.
 *
 * When `hasBreadcrumbs` is true, a `breadcrumb` back-reference is
 * added pointing at the BreadcrumbList entity. Callers are
 * responsible for emitting the matching BreadcrumbList piece.
 */
export function buildWebPage(
  page: PublicPageContext,
  canonical: string | null,
  ogTitle: string,
  description: string | null,
  locale: string,
  ids: IdFactory,
  hasBreadcrumbs: boolean,
): Record<string, unknown> {
  const pageUrl = canonical || page.url;

  const node: Record<string, unknown> = {
    "@type": getWebPageType(page),
    "@id": ids.webPage(pageUrl),
    url: pageUrl,
    name: ogTitle,
    isPartOf: { "@id": ids.website },
    inLanguage: locale,
  };

  if (description) {
    node.description = description;
  }

  if (hasBreadcrumbs) {
    node.breadcrumb = { "@id": ids.breadcrumb(pageUrl) };
  }

  if (page.articleMeta?.publishedTime) {
    node.datePublished = page.articleMeta.publishedTime;
  }
  if (page.articleMeta?.modifiedTime) {
    node.dateModified = page.articleMeta.modifiedTime;
  }

  return node;
}
