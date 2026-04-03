import type { PublicPageContext } from "emdash";
import type { SeoSettings } from "../settings.js";
import { buildSiteEntity } from "./organization.js";
import { buildWebSite } from "./website.js";
import { buildWebPage } from "./webpage.js";
import { buildArticle } from "./article.js";
import { buildAuthorPerson } from "./person.js";

/**
 * Build the complete JSON-LD schema graph for a page.
 * Outputs a @graph array with distinct, linked nodes.
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

  const graph: Record<string, unknown>[] = [];

  // 1. Site entity (Organization or Person) - always present
  graph.push(buildSiteEntity(settings, siteUrl, siteName, locale));

  // 2. WebSite - always present
  graph.push(
    buildWebSite(settings, siteUrl, siteName, settings.defaultDescription || null, locale),
  );

  // 3. WebPage - always present
  graph.push(buildWebPage(page, siteUrl, canonical, ogTitle, description, locale));

  // 4. Article + Author Person - for content pages with article meta
  if (page.kind === "content" && page.articleMeta?.publishedTime) {
    const article = buildArticle(
      page, settings, siteUrl, siteName, canonical, ogTitle, description, locale,
    );
    if (article) graph.push(article);

    const author = buildAuthorPerson(settings, siteUrl, siteName);
    if (author) graph.push(author);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
