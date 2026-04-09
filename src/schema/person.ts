import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { SeoSettings } from "../settings.js";

/**
 * Build the author Person schema node. Returned as a separate piece
 * only when the site represents an Organization — for Person sites
 * the site entity already covers this node.
 *
 * Required fields are @type, @id, name. Names like "admin" are
 * rejected per schema.org best practice.
 */
export function buildAuthorPerson(
  settings: SeoSettings,
  siteName: string,
  ids: IdFactory,
): Record<string, unknown> | null {
  const name = settings.personName || siteName;

  // Per spec: reject "admin" or similar invalid author names
  if (!name || name.toLowerCase() === "admin") return null;

  const node: Record<string, unknown> = {
    "@type": "Person",
    "@id": ids.person,
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
      "@id": ids.personImage,
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
