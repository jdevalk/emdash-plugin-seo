import type { PublicPageContext, PageMetadataContribution } from "emdash";
import type { SeoSettings } from "./settings.js";

/**
 * Generate Open Graph and Twitter Card meta contributions.
 * og:type is "article" for all content types (posts, pages, videos).
 */
/**
 * Convert a language code to OG locale format (e.g. "en" -> "en_US", "en-GB" -> "en_GB").
 */
function toOgLocale(locale: string): string {
  if (locale.includes("_")) return locale;
  if (locale.includes("-")) return locale.replace("-", "_");
  // Bare language code — append common region
  const regionMap: Record<string, string> = {
    en: "en_US", nl: "nl_NL", de: "de_DE", fr: "fr_FR", es: "es_ES",
    it: "it_IT", pt: "pt_BR", ja: "ja_JP", zh: "zh_CN", ko: "ko_KR",
  };
  return regionMap[locale] || `${locale}_${locale.toUpperCase()}`;
}

export function generateOpengraph(
  page: PublicPageContext,
  settings: SeoSettings,
  ogTitle: string,
  description: string | null,
  canonical: string | null,
  locale: string,
): PageMetadataContribution[] {
  const contributions: PageMetadataContribution[] = [];
  const path = page.path || "/";

  // Skip most OG tags on 404
  if (path === "/404") {
    if (page.siteName) {
      contributions.push({ kind: "property", property: "og:site_name", content: page.siteName });
    }
    contributions.push({ kind: "property", property: "og:locale", content: toOgLocale(locale) });
    return contributions;
  }

  // og:type - "article" for content pages, "website" for archives/homepage
  const isContent = page.kind === "content";
  contributions.push({
    kind: "property",
    property: "og:type",
    content: isContent ? "article" : "website",
  });

  // og:title
  if (ogTitle) {
    contributions.push({ kind: "property", property: "og:title", content: ogTitle });
  }

  // og:description
  if (description) {
    contributions.push({ kind: "property", property: "og:description", content: description });
  }

  // og:image
  if (page.image) {
    contributions.push({ kind: "property", property: "og:image", content: page.image });
  }

  // og:url
  if (canonical) {
    contributions.push({ kind: "property", property: "og:url", content: canonical });
  }

  // og:site_name
  if (page.siteName) {
    contributions.push({ kind: "property", property: "og:site_name", content: page.siteName });
  }

  // og:locale
  contributions.push({ kind: "property", property: "og:locale", content: toOgLocale(locale) });

  // Article meta
  if (isContent && page.articleMeta) {
    if (page.articleMeta.publishedTime) {
      contributions.push({
        kind: "property",
        property: "article:published_time",
        content: page.articleMeta.publishedTime,
      });
    }
    if (page.articleMeta.modifiedTime) {
      contributions.push({
        kind: "property",
        property: "article:modified_time",
        content: page.articleMeta.modifiedTime,
      });
    }
    if (page.articleMeta.author) {
      contributions.push({
        kind: "property",
        property: "article:author",
        content: page.articleMeta.author,
      });
    }
  }

  // Twitter Card
  contributions.push({
    kind: "meta",
    name: "twitter:card",
    content: page.image ? "summary_large_image" : "summary",
  });

  if (ogTitle) {
    contributions.push({ kind: "meta", name: "twitter:title", content: ogTitle });
  }
  if (description) {
    contributions.push({ kind: "meta", name: "twitter:description", content: description });
  }
  if (page.image) {
    contributions.push({ kind: "meta", name: "twitter:image", content: page.image });
  }

  // Twitter site handle from settings
  const twitterUrl = settings.socials.find(
    (s) => s.includes("twitter.com/") || s.includes("x.com/"),
  );
  if (twitterUrl) {
    const handle = twitterUrl.split("/").pop();
    if (handle) {
      contributions.push({ kind: "meta", name: "twitter:site", content: `@${handle}` });
    }
  }

  return contributions;
}
