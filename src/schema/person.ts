import { buildPiece } from "@jdevalk/seo-graph-core";
import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { Person } from "schema-dts";
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

  const piece = buildPiece<Person>({
    "@type": "Person",
    "@id": ids.person,
    name,
  });

  if (settings.personDescription) {
    piece.description = settings.personDescription.slice(0, 250);
  }

  if (settings.personUrl) {
    piece.url = settings.personUrl;
  }

  if (settings.personImageUrl) {
    piece.image = {
      "@type": "ImageObject",
      "@id": ids.personImage,
      url: settings.personImageUrl,
      contentUrl: settings.personImageUrl,
      caption: name,
    };
  }

  if (settings.socials.length > 0) {
    piece.sameAs = settings.socials;
  }

  return piece;
}
