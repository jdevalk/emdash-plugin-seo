import {
  buildWebPage as coreBuildWebPage,
  type WebPageType,
} from "@jdevalk/seo-graph-core";
import type { IdFactory, Reference } from "@jdevalk/seo-graph-core";
import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "../settings.js";

const COLLECTION_PAGE_PATHS = new Set(["/", "/posts", "/posts/", "/videos", "/videos/"]);

const PROFILE_PAGE_PATHS = new Set(["/about", "/about/"]);

/**
 * Determine the WebPage @type based on the page path.
 */
function getWebPageType(page: PublicPageContext): WebPageType {
  const path = page.path || "/";

  if (PROFILE_PAGE_PATHS.has(path)) return "ProfilePage";
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
  settings: SeoSettings,
  canonical: string | null,
  ogTitle: string,
  description: string | null,
  locale: string,
  ids: IdFactory,
  hasBreadcrumbs: boolean,
  siteEntityId: string,
): Record<string, unknown> {
  const pageUrl = canonical || page.url;
  const type = getWebPageType(page);

  // Homepage and ProfilePage carry an `about` reference to the site entity.
  const isAboutPage = type === "ProfilePage" || (page.path || "/") === "/";
  const about: Reference | undefined = isAboutPage
    ? { "@id": siteEntityId }
    : undefined;

  // Primary image reference when the page has an image.
  const primaryImage: Reference | undefined = page.image
    ? { "@id": ids.primaryImage(pageUrl) }
    : undefined;

  // Copyright fields from settings.
  const copyrightHolder: Reference | undefined = settings.copyrightYear
    ? { "@id": siteEntityId }
    : undefined;

  return coreBuildWebPage(
    {
      url: pageUrl,
      name: ogTitle,
      isPartOf: { "@id": ids.website },
      inLanguage: locale,
      description: description || undefined,
      breadcrumb: hasBreadcrumbs ? { "@id": ids.breadcrumb(pageUrl) } : undefined,
      datePublished: page.articleMeta?.publishedTime
        ? new Date(page.articleMeta.publishedTime)
        : undefined,
      dateModified: page.articleMeta?.modifiedTime
        ? new Date(page.articleMeta.modifiedTime)
        : undefined,
      about,
      primaryImage,
      copyrightHolder,
      copyrightYear: settings.copyrightYear || undefined,
      license: settings.licenseUrl || undefined,
    },
    ids,
    type,
  );
}
