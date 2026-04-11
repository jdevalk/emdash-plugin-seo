import { buildWebSite as coreBuildWebSite } from "@jdevalk/seo-graph-core";
import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { SeoSettings } from "../settings.js";
import { getSiteEntityId } from "./organization.js";

/**
 * Build the WebSite schema node.
 * Every page includes a WebSite node with SearchAction.
 */
export function buildWebSite(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
  siteDescription: string | null,
  locale: string,
  ids: IdFactory,
  hasNavigation: boolean,
): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  const piece = coreBuildWebSite(
    {
      url: `${baseUrl}/`,
      name: siteName,
      publisher: { "@id": getSiteEntityId(settings, ids) },
      inLanguage: locale,
      description: siteDescription || undefined,
      hasPart: hasNavigation ? { "@id": ids.navigation } : undefined,
    },
    ids,
  );

  // SearchAction with Google's query-input extension — not in schema-dts
  // types, so set directly on the result.
  piece.potentialAction = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/search?q={search_term_string}`,
    },
    "query-input": {
      "@type": "PropertyValueSpecification",
      valueRequired: "http://schema.org/True",
      valueName: "search_term_string",
    },
  };

  return piece;
}
