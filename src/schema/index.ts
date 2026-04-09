import type { PublicPageContext } from "emdash";
import {
  assembleGraph,
  buildBreadcrumbList,
  makeIds,
  type GraphEntity,
} from "@jdevalk/seo-graph-core";
import type { SeoSettings } from "../settings.js";
import { buildSiteEntity } from "./organization.js";
import { buildWebSite } from "./website.js";
import { buildWebPage } from "./webpage.js";
import { buildArticle } from "./article.js";
import { buildAuthorPerson } from "./person.js";
import { buildBreadcrumbs } from "./breadcrumb.js";

/**
 * Build the complete JSON-LD schema graph for a page.
 * Outputs a @graph array with distinct, linked nodes.
 *
 * The individual piece builders (`buildSiteEntity`, `buildWebSite`,
 * `buildWebPage`, `buildArticle`, `buildAuthorPerson`) stay EmDash-specific
 * because EmDash has its own WebSite SearchAction shape and its own
 * Organization-or-Person site entity dispatch that don't map cleanly
 * onto `@jdevalk/seo-graph-core`'s piece builders.
 *
 * What we share with joost.blog via seo-graph-core is (a) the envelope
 * — `assembleGraph` wraps pieces in `{ @context, @graph }` with
 * first-wins deduplication by `@id` — and (b) the `@id` scheme via
 * `makeIds()`, so both consumers emit structurally-identical graphs
 * even though they build the pieces very differently. Breadcrumbs
 * use `buildBreadcrumbList` directly from core since the wrapper
 * shape is the same everywhere.
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

  const pieces: GraphEntity[] = [];

  // 1. Site entity (Organization or Person) - always present
  pieces.push(buildSiteEntity(settings, siteUrl, siteName, locale, ids) as GraphEntity);

  // 2. WebSite - always present
  pieces.push(
    buildWebSite(
      settings,
      siteUrl,
      siteName,
      settings.defaultDescription || null,
      locale,
      ids,
    ) as GraphEntity,
  );

  // 3. WebPage - always present
  pieces.push(
    buildWebPage(page, canonical, ogTitle, description, locale, ids, hasBreadcrumbs) as GraphEntity,
  );

  // 4. BreadcrumbList - when derived/ruled with >1 crumb
  if (hasBreadcrumbs) {
    pieces.push(
      buildBreadcrumbList({ url: pageUrl, items: crumbs! }, ids) as GraphEntity,
    );
  }

  // 5. Article + Author Person - for content pages with article meta
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
    );
    if (article) pieces.push(article as GraphEntity);

    // For Organization sites the author Person is a distinct entity
    // from the site entity, so emit it separately. For Person sites
    // the site entity already is this Person — assembleGraph's
    // first-wins dedupe keeps the richer site-entity version.
    const author = buildAuthorPerson(settings, siteName, ids);
    if (author) pieces.push(author as GraphEntity);
  }

  return assembleGraph(pieces);
}
