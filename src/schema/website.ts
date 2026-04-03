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
): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  const node: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    url: `${baseUrl}/`,
    name: siteName,
    publisher: { "@id": getSiteEntityId(settings, siteUrl, siteName) },
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  if (siteDescription) {
    node.description = siteDescription;
  }

  return node;
}
