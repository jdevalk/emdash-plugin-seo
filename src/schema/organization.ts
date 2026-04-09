import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { SeoSettings } from "../settings.js";

/**
 * Build the Organization or Person node representing the site entity.
 * Every page includes an Organization or Person node.
 */
export function buildSiteEntity(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
  locale: string,
  ids: IdFactory,
): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  if (settings.siteRepresents === "organization") {
    const orgLogoId = `${baseUrl}/#/schema.org/ImageObject/logo`;
    const node: Record<string, unknown> = {
      "@type": "Organization",
      "@id": ids.organization(orgSlug(settings)),
      name: settings.orgName || siteName,
      url: baseUrl,
    };

    if (settings.orgLogoUrl) {
      node.logo = {
        "@type": "ImageObject",
        "@id": orgLogoId,
        url: settings.orgLogoUrl,
        contentUrl: settings.orgLogoUrl,
        inLanguage: locale,
      };
      node.image = { "@id": orgLogoId };
    }

    if (settings.socials.length > 0) {
      node.sameAs = settings.socials;
    }

    return node;
  }

  // Person
  const name = settings.personName || siteName;
  const node: Record<string, unknown> = {
    "@type": "Person",
    "@id": ids.person,
    name,
    url: baseUrl,
  };

  if (settings.personDescription) {
    node.description = settings.personDescription.slice(0, 250);
  }

  if (settings.personJobTitle) {
    node.jobTitle = settings.personJobTitle;
  }

  if (settings.personImageUrl) {
    node.image = {
      "@type": "ImageObject",
      "@id": ids.personImage,
      url: settings.personImageUrl,
      contentUrl: settings.personImageUrl,
      inLanguage: locale,
      caption: name,
    };
  }

  if (settings.socials.length > 0) {
    node.sameAs = settings.socials;
  }

  return node;
}

/**
 * Get the @id reference for the site entity — either the site-wide
 * Person or an Organization. Used by other pieces (Article, WebSite)
 * that need to reference the publisher.
 */
export function getSiteEntityId(settings: SeoSettings, ids: IdFactory): string {
  if (settings.siteRepresents === "organization") {
    return ids.organization(orgSlug(settings));
  }
  return ids.person;
}

/**
 * Slugify the organization name for use as the Organization @id slug.
 * `makeIds` takes a slug so multi-org sites are possible; the plugin
 * only models one, so this just slugifies the configured name (or
 * falls back to `"site"` if unset).
 */
function orgSlug(settings: SeoSettings): string {
  const name = settings.orgName || "site";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "site";
}
