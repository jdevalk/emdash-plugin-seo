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
): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  const node: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": ids.website,
    url: `${baseUrl}/`,
    name: siteName,
    publisher: { "@id": getSiteEntityId(settings, ids) },
    inLanguage: locale,
    potentialAction: {
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
    },
  };

  if (siteDescription) {
    node.description = siteDescription;
  }

  return node;
}
