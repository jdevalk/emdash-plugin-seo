import type { PageMetadataEvent, PageMetadataContribution, PluginContext } from "emdash";
import { loadSettings } from "./settings.js";
import { generateOgTitle } from "./titles.js";
import { generateDescription } from "./descriptions.js";
import { generateRobots } from "./robots.js";
import { generateCanonical } from "./canonical.js";
import { generateOpengraph } from "./opengraph.js";
import { generateHreflang } from "./hreflang.js";
import { buildSchemaGraph } from "./schema/index.js";

/**
 * Main page:metadata hook handler.
 * Orchestrates all SEO contribution modules.
 */
export async function metadataHandler(
  event: PageMetadataEvent,
  ctx: PluginContext,
): Promise<PageMetadataContribution[]> {
  const { page } = event;
  const settings = await loadSettings(ctx.kv);
  const siteUrl = ctx.site.url;
  const siteName = page.siteName || ctx.site.name;
  const locale = page.locale || ctx.site.locale || "en";

  const contributions: PageMetadataContribution[] = [];

  // 1. OG title (page title without site name)
  const ogTitle = generateOgTitle(page, settings);

  // 2. Description
  const description = generateDescription(page, settings);

  // 3. Meta description
  if (description) {
    contributions.push({ kind: "meta", name: "description", content: description });
  }

  // 4. Robots
  const robots = generateRobots(page);
  if (robots) {
    contributions.push({ kind: "meta", name: "robots", content: robots });
  }

  // 5. Canonical
  const canonical = generateCanonical(page, siteUrl);
  if (canonical) {
    contributions.push({ kind: "link", rel: "canonical", href: canonical });
  }

  // 5b. hreflang alternates (multilingual content sites only)
  // Short-circuits internally when i18n is disabled — zero cost on
  // single-locale sites.
  const hreflangContributions = await generateHreflang(page, ctx, siteUrl);
  contributions.push(...hreflangContributions);

  // 6. Open Graph + Twitter
  const ogContributions = generateOpengraph(page, settings, ogTitle, description, canonical, locale);
  contributions.push(...ogContributions);

  // 7. JSON-LD Schema graph (replaces base "primary" JSON-LD)
  const schema = buildSchemaGraph(
    page, settings, siteUrl, siteName, canonical, ogTitle, description, locale,
  );
  if (schema) {
    contributions.push({ kind: "jsonld", id: "primary", graph: schema });
  }

  // 8. NLWeb discovery link — advertises a conversational endpoint so
  // agents can discover the site's chat surface without scraping HTML.
  if (settings.nlwebEndpoint) {
    contributions.push({ kind: "link", rel: "nlweb", href: settings.nlwebEndpoint });
  }

  return contributions;
}
