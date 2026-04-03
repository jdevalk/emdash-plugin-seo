import type { SeoSettings } from "../settings.js";

/**
 * Build the author Person schema node.
 * Required fields are @type, @id, name.
 * Names like "admin" should be rejected.
 */
export function buildAuthorPerson(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
): Record<string, unknown> | null {
  const name = settings.personName || siteName;

  // Per spec: reject "admin" or similar invalid author names
  if (!name || name.toLowerCase() === "admin") return null;

  const baseUrl = siteUrl.replace(/\/$/, "");
  const node: Record<string, unknown> = {
    "@type": "Person",
    "@id": getAuthorPersonId(settings, siteUrl, siteName),
    name,
  };

  if (settings.personDescription) {
    node.description = settings.personDescription.slice(0, 250);
  }

  if (settings.personUrl) {
    node.url = settings.personUrl;
  }

  if (settings.personImageUrl) {
    node.image = {
      "@type": "ImageObject",
      "@id": `${baseUrl}/#authorlogo`,
      url: settings.personImageUrl,
      contentUrl: settings.personImageUrl,
      caption: name,
    };
  }

  if (settings.socials.length > 0) {
    node.sameAs = settings.socials;
  }

  return node;
}

export function getAuthorPersonId(
  settings: SeoSettings,
  siteUrl: string,
  siteName: string,
): string {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const name = settings.personName || siteName;
  const hash = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${baseUrl}/#/schema/person/${hash}`;
}
