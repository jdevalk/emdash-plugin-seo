import { buildPiece } from "@jdevalk/seo-graph-core";
import type { IdFactory } from "@jdevalk/seo-graph-core";
import type { Organization, Person } from "schema-dts";
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
    return buildOrganizationEntity(settings, baseUrl, siteName, locale, ids);
  }

  return buildPersonEntity(settings, baseUrl, siteName, locale, ids);
}

function buildOrganizationEntity(
  settings: SeoSettings,
  baseUrl: string,
  siteName: string,
  locale: string,
  ids: IdFactory,
): Record<string, unknown> {
  const orgLogoId = `${baseUrl}/#/schema.org/ImageObject/logo`;

  const piece = buildPiece<Organization>({
    "@type": "Organization",
    "@id": ids.organization(orgSlug(settings)),
    name: settings.orgName || siteName,
    url: baseUrl,
  });

  if (settings.orgLogoUrl) {
    piece.logo = {
      "@type": "ImageObject",
      "@id": orgLogoId,
      url: settings.orgLogoUrl,
      contentUrl: settings.orgLogoUrl,
      inLanguage: locale,
    };
    piece.image = { "@id": orgLogoId };
  }

  if (settings.socials.length > 0) {
    piece.sameAs = settings.socials;
  }

  if (settings.publishingPrinciples) {
    piece.publishingPrinciples = settings.publishingPrinciples;
  }

  return piece;
}

function buildPersonEntity(
  settings: SeoSettings,
  baseUrl: string,
  siteName: string,
  locale: string,
  ids: IdFactory,
): Record<string, unknown> {
  const name = settings.personName || siteName;

  const piece = buildPiece<Person>({
    "@type": "Person",
    "@id": ids.person,
    name,
    url: baseUrl,
  });

  if (settings.personDescription) {
    piece.description = settings.personDescription.slice(0, 250);
  }

  if (settings.personJobTitle) {
    piece.jobTitle = settings.personJobTitle;
  }

  if (settings.personImageUrl) {
    piece.image = {
      "@type": "ImageObject",
      "@id": ids.personImage,
      url: settings.personImageUrl,
      contentUrl: settings.personImageUrl,
      inLanguage: locale,
      caption: name,
    };
  }

  if (settings.socials.length > 0) {
    piece.sameAs = settings.socials;
  }

  if (settings.publishingPrinciples) {
    piece.publishingPrinciples = settings.publishingPrinciples;
  }

  return piece;
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
 */
function orgSlug(settings: SeoSettings): string {
  const name = settings.orgName || "site";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "site";
}
