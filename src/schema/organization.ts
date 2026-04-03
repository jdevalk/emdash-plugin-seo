import type { SeoSettings } from "../settings.js";

/**
 * Build the Organization or Person node representing the site entity.
 * Every page includes an Organization or Person node.
 */
export function buildSiteEntity(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  if (settings.siteRepresents === "organization") {
    const node: Record<string, unknown> = {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization`,
      name: settings.orgName || siteName,
      url: baseUrl,
    };

    if (settings.orgLogoUrl) {
      node.logo = {
        "@type": "ImageObject",
        "@id": `${baseUrl}/#logo`,
        url: settings.orgLogoUrl,
        contentUrl: settings.orgLogoUrl,
        inLanguage: "en-US",
      };
      node.image = { "@id": `${baseUrl}/#logo` };
    }

    if (settings.socials.length > 0) {
      node.sameAs = settings.socials;
    }

    return node;
  }

  // Person
  const name = settings.personName || siteName;
  const node: Record<string, unknown> = {
    "@type": ["Person", "Organization"],
    "@id": `${baseUrl}/#/schema/person/${hashId(name)}`,
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
      "@id": `${baseUrl}/#personlogo`,
      url: settings.personImageUrl,
      contentUrl: settings.personImageUrl,
      inLanguage: "en-US",
      caption: name,
    };
  }

  if (settings.socials.length > 0) {
    node.sameAs = settings.socials;
  }

  return node;
}

/**
 * Get the @id reference for the site entity.
 */
export function getSiteEntityId(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
): string {
  const baseUrl = siteUrl.replace(/\/$/, "");
  if (settings.siteRepresents === "organization") {
    return `${baseUrl}/#organization`;
  }
  const name = settings.personName || siteName;
  return `${baseUrl}/#/schema/person/${hashId(name)}`;
}

function hashId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
