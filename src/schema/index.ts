import type { PublicPageContext } from "emdash";
import {
  assembleGraph,
  buildBreadcrumbList,
  buildImageObject,
  buildPiece,
  buildSiteNavigationElement,
  makeIds,
  type GraphEntity,
} from "@jdevalk/seo-graph-core";
import type { Blog } from "schema-dts";
import type { SeoSettings } from "../settings.js";
import { buildSiteEntity, getSiteEntityId } from "./organization.js";
import { buildWebSite } from "./website.js";
import { buildWebPage } from "./webpage.js";
import { buildArticle } from "./article.js";
import { buildAuthorPerson } from "./person.js";
import { buildBreadcrumbs } from "./breadcrumb.js";

/**
 * Build the complete JSON-LD schema graph for a page.
 * Outputs a @graph array with distinct, linked nodes.
 *
 * Individual piece builders delegate to `@jdevalk/seo-graph-core`'s
 * typed builders (`buildWebSite`, `buildWebPage`, `buildArticle`,
 * `buildPiece<Organization>`, `buildPiece<Person>`) with thin
 * EmDash-specific wrappers that map EmDash's page/settings model
 * onto core's input types. This keeps both EmDash and joost.blog on
 * the same code path for graph construction, not just the ID scheme.
 */
export function buildSchemaGraph(
  page: PublicPageContext,
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
  canonical: string | null,
  ogTitle: string,
  description: string | null,
  locale: string,
  keywords?: string[],
  articleSection?: string,
): Record<string, unknown> | null {
  // No schema for 404 pages
  if (page.path === "/404") return null;

  const ids = makeIds({
    siteUrl,
    personUrl: settings.personUrl || undefined,
  });

  // Compute breadcrumbs early so the WebPage node can carry a
  // back-reference (`breadcrumb: { "@id": ... }`) when present.
  const crumbs = buildBreadcrumbs(page, settings, siteUrl);
  const hasBreadcrumbs = crumbs !== null && crumbs.length > 1;
  const pageUrl = canonical || page.url;
  const siteEntityId = getSiteEntityId(settings, ids);

  // Derive Blog @id when blog settings are configured.
  const blogId = settings.blogUrl
    ? `${settings.blogUrl.replace(/\/$/, "")}/#blog`
    : null;

  const pieces: GraphEntity[] = [];

  // 1. Site entity (Organization or Person) - always present
  pieces.push(buildSiteEntity(settings, siteUrl, siteName, locale, ids) as GraphEntity);

  // 2. WebSite - always present
  const hasNavigation = settings.navigationItems.length > 0;
  pieces.push(
    buildWebSite(
      settings,
      siteUrl,
      siteName,
      settings.defaultDescription || null,
      locale,
      ids,
      hasNavigation,
    ) as GraphEntity,
  );

  // 3. SiteNavigationElement - when navigation items are configured
  if (hasNavigation) {
    pieces.push(
      buildSiteNavigationElement(
        {
          name: "Main navigation",
          isPartOf: { "@id": ids.website },
          items: settings.navigationItems,
        },
        ids,
      ) as GraphEntity,
    );
  }

  // 4. Blog entity - when blog URL is configured
  if (blogId && settings.blogUrl) {
    pieces.push(
      buildPiece<Blog>({
        "@type": "Blog",
        "@id": blogId,
        name: settings.blogName || "Blog",
        url: settings.blogUrl,
        publisher: { "@id": siteEntityId },
        inLanguage: locale,
      }) as GraphEntity,
    );
  }

  // 5. WebPage - always present
  pieces.push(
    buildWebPage(
      page, settings, canonical, ogTitle, description, locale, ids,
      hasBreadcrumbs, siteEntityId,
    ) as GraphEntity,
  );

  // 6. BreadcrumbList - when derived/ruled with >1 crumb
  if (hasBreadcrumbs) {
    pieces.push(
      buildBreadcrumbList({ url: pageUrl, items: crumbs! }, ids) as GraphEntity,
    );
  }

  // 7. Primary ImageObject - when the page has an image
  if (page.image) {
    pieces.push(
      buildImageObject(
        {
          pageUrl,
          url: page.image,
          width: 1200,
          height: 675,
          inLanguage: locale,
        },
        ids,
      ) as GraphEntity,
    );
  }

  // 8. Article + Author Person - for content pages with article meta
  if (page.kind === "content" && page.articleMeta?.publishedTime) {
    const article = buildArticle(
      page,
      settings,
      siteName,
      canonical,
      ogTitle,
      description,
      locale,
      ids,
      blogId,
      keywords,
      articleSection,
    );
    if (article) pieces.push(article as GraphEntity);

    // For Organization sites the author Person is a distinct entity
    // from the site entity, so emit it separately. For Person sites
    // the site entity already is this Person — assembleGraph's
    // first-wins dedupe keeps the richer site-entity version.
    const author = buildAuthorPerson(settings, siteName, ids);
    if (author) pieces.push(author as GraphEntity);
  }

  return assembleGraph(pieces, { warnOnDanglingReferences: true });
}
