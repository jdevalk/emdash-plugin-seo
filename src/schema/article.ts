import { buildArticle as coreBuildArticle } from "@jdevalk/seo-graph-core";
import type { IdFactory, Reference } from "@jdevalk/seo-graph-core";
import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "../settings.js";
import { getSiteEntityId } from "./organization.js";

/**
 * Build the Article (or BlogPosting) schema node.
 * Output on all content types that support authorship.
 * Required: headline, datePublished, author, publisher.
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
  blogId: string | null,
  keywords?: string[],
  articleSection?: string,
): Record<string, unknown> | null {
  const pageUrl = canonical || page.url;

  // Required fields per spec - if missing, don't output
  if (!ogTitle || !page.articleMeta?.publishedTime) return null;

  const siteEntityId = getSiteEntityId(settings, ids);
  const webPageRef: Reference = { "@id": ids.webPage(pageUrl) };

  // When a Blog entity exists, link the posting to both WebPage and Blog.
  const isPartOf: Reference | Reference[] = blogId
    ? [webPageRef, { "@id": blogId }]
    : webPageRef;

  // Copyright fields from settings.
  const copyrightHolder: Reference | undefined = settings.copyrightYear
    ? { "@id": siteEntityId }
    : undefined;

  const piece = coreBuildArticle(
    {
      url: pageUrl,
      isPartOf: isPartOf as Reference,
      author: {
        "@id": ids.person,
        name: settings.personName || siteName,
      },
      publisher: { "@id": siteEntityId },
      headline: ogTitle,
      description: description || "",
      datePublished: new Date(page.articleMeta.publishedTime),
      dateModified: page.articleMeta.modifiedTime
        ? new Date(page.articleMeta.modifiedTime)
        : undefined,
      inLanguage: locale,
      image: page.image ? { "@id": ids.primaryImage(pageUrl) } : undefined,
      copyrightHolder,
      copyrightYear: settings.copyrightYear || undefined,
      license: settings.licenseUrl || undefined,
      keywords: keywords?.length ? keywords.join(", ") : undefined,
      articleSection: articleSection || undefined,
    },
    ids,
    "BlogPosting",
  );

  return piece;
}
