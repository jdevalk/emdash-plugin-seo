import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "../settings.js";
import { getSiteEntityId } from "./organization.js";

/**
 * Build the Article schema node.
 * Output on all content types that support authorship.
 * Required: headline, datePublished, dateModified, author, publisher.
 */
export function buildArticle(
  page: PublicPageContext,
  settings: SeoSettings,
  siteName: string,
  canonical: string | null,
  ogTitle: string,
  description: string | null,
  locale: string,
  ids: IdFactory,
): Record<string, unknown> | null {
  const pageUrl = canonical || page.url;

  // Required fields per spec - if missing, don't output
  if (!ogTitle || !page.articleMeta?.publishedTime) return null;

  const webPageId = ids.webPage(pageUrl);
  const node: Record<string, unknown> = {
    "@type": "Article",
    "@id": ids.article(pageUrl),
    headline: ogTitle,
    isPartOf: { "@id": webPageId },
    mainEntityOfPage: { "@id": webPageId },
    datePublished: page.articleMeta.publishedTime,
    author: {
      "@id": ids.person,
      name: settings.personName || siteName,
    },
    publisher: { "@id": getSiteEntityId(settings, ids) },
    inLanguage: locale,
  };

  if (page.articleMeta.modifiedTime) {
    node.dateModified = page.articleMeta.modifiedTime;
  }

  if (description) {
    node.description = description;
  }

  if (page.image) {
    node.image = page.image;
  }

  return node;
}
