import type { PublicPageContext } from "emdash";
import { assembleGraph, type GraphEntity } from "@jdevalk/seo-graph-core";
import type { SeoSettings } from "../settings.js";
import { buildSiteEntity } from "./organization.js";
import { buildWebSite } from "./website.js";
import { buildWebPage } from "./webpage.js";
import { buildArticle } from "./article.js";
import { buildAuthorPerson } from "./person.js";

/**
 * Build the complete JSON-LD schema graph for a page.
 * Outputs a @graph array with distinct, linked nodes.
 *
 * The individual piece builders (`buildSiteEntity`, `buildWebSite`,
 * `buildWebPage`, `buildArticle`, `buildAuthorPerson`) stay EmDash-specific
 * because EmDash has its own @id scheme, its own WebSite SearchAction
 * shape, and its own Organization-or-Person site entity dispatch that
 * don't map cleanly onto `@jdevalk/seo-graph-core`'s piece builders.
 *
 * What we share with joost.blog via seo-graph-core is the envelope:
 * `assembleGraph` wraps the pieces in `{ @context, @graph }` with
 * first-wins deduplication by `@id`. That's the same engine behind the
 * Astro integration's `createSchemaEndpoint`, so both consumers emit
 * structurally-identical graphs even though they build the pieces very
 * differently.
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

  const pieces: GraphEntity[] = [];

  // 1. Site entity (Organization or Person) - always present
  pieces.push(buildSiteEntity(settings, siteUrl, siteName, locale) as GraphEntity);

  // 2. WebSite - always present
  pieces.push(
    buildWebSite(settings, siteUrl, siteName, settings.defaultDescription || null, locale) as GraphEntity,
  );

  // 3. WebPage - always present
  pieces.push(buildWebPage(page, siteUrl, canonical, ogTitle, description, locale) as GraphEntity);

  // 4. Article + Author Person - for content pages with article meta
  if (page.kind === "content" && page.articleMeta?.publishedTime) {
    const article = buildArticle(
      page, settings, siteUrl, siteName, canonical, ogTitle, description, locale,
    );
    if (article) pieces.push(article as GraphEntity);

    const author = buildAuthorPerson(settings, siteUrl, siteName);
    if (author) pieces.push(author as GraphEntity);
  }

  return assembleGraph(pieces);
}
