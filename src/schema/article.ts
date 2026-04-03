import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "../settings.js";
import { getSiteEntityId } from "./organization.js";
import { getAuthorPersonId } from "./person.js";

/**
 * Build the Article schema node.
 * Output on all content types that support authorship.
 * Required: headline, datePublished, dateModified, author, publisher.
 */
export function buildArticle(
  page: PublicPageContext,
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
  canonical: string | null,
  ogTitle: string,
  description: string | null,
  locale: string,
): Record<string, unknown> | null {
  const pageUrl = canonical || page.url;

  // Required fields per spec - if missing, don't output
  if (!ogTitle || !page.articleMeta?.publishedTime) return null;

  const node: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: ogTitle,
    isPartOf: { "@id": `${pageUrl}#webpage` },
    mainEntityOfPage: { "@id": `${pageUrl}#webpage` },
    datePublished: page.articleMeta.publishedTime,
    author: {
      "@id": getAuthorPersonId(settings, siteUrl, siteName),
      name: settings.personName || siteName,
    },
    publisher: { "@id": getSiteEntityId(settings, siteUrl, siteName) },
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
