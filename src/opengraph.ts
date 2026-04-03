import type { PublicPageContext, PageMetadataContribution } from "emdash";
import type { SeoSettings } from "./settings.js";

/**
 * Generate Open Graph and Twitter Card meta contributions.
 * og:type is "article" for all content types (posts, pages, videos).
 */
/**
 * Bare language codes that need a specific region suffix
 * (where the region doesn't match the language code).
 */
const FIX_LOCALES: Record<string, string> = {
  ca: "ca_ES", en: "en_US", el: "el_GR", et: "et_EE",
  ja: "ja_JP", sq: "sq_AL", uk: "uk_UA", vi: "vi_VN", zh: "zh_CN",
};

/**
 * Complete set of valid Facebook/Open Graph locales.
 */
const VALID_LOCALES = new Set([
  "af_ZA", "ak_GH", "am_ET", "ar_AR", "as_IN", "ay_BO", "az_AZ",
  "be_BY", "bg_BG", "bn_IN", "bp_IN", "br_FR", "bs_BA",
  "ca_ES", "cb_IQ", "ck_US", "co_FR", "cs_CZ", "cx_PH", "cy_GB",
  "da_DK", "de_DE",
  "el_GR", "em_ZM", "en_GB", "en_PI", "en_UD", "en_US", "eo_EO",
  "es_ES", "es_LA", "es_MX", "et_EE", "eu_ES",
  "fa_IR", "fb_LT", "ff_NG", "fi_FI", "fo_FO", "fr_CA", "fr_FR", "fy_NL",
  "ga_IE", "gl_ES", "gn_PY", "gu_IN", "gx_GR",
  "ha_NG", "he_IL", "hi_IN", "hr_HR", "ht_HT", "hu_HU", "hy_AM",
  "id_ID", "ig_NG", "ik_US", "is_IS", "it_IT", "iu_CA",
  "ja_JP", "ja_KS", "jv_ID",
  "ka_GE", "kk_KZ", "km_KH", "kn_IN", "ko_KR", "ks_IN", "ku_TR", "ky_KG",
  "la_VA", "lg_UG", "li_NL", "ln_CD", "lo_LA", "lt_LT", "lv_LV",
  "mg_MG", "mi_NZ", "mk_MK", "ml_IN", "mn_MN", "mr_IN", "ms_MY", "mt_MT", "my_MM",
  "nb_NO", "nd_ZW", "ne_NP", "nl_BE", "nl_NL", "nn_NO", "nr_ZA", "ns_ZA", "ny_MW",
  "om_ET", "or_IN",
  "pa_IN", "pl_PL", "ps_AF", "pt_BR", "pt_PT",
  "qc_GT", "qr_GR", "qu_PE", "qz_MM",
  "rm_CH", "ro_RO", "ru_RU", "rw_RW",
  "sa_IN", "sc_IT", "se_NO", "si_LK", "sk_SK", "sl_SI", "sn_ZW", "so_SO",
  "sq_AL", "sr_RS", "ss_SZ", "st_ZA", "su_ID", "sv_SE", "sw_KE", "sy_SY", "sz_PL",
  "ta_IN", "te_IN", "tg_TJ", "th_TH", "tk_TM", "tl_PH", "tl_ST", "tn_BW",
  "tr_TR", "ts_ZA", "tt_RU", "tz_MA",
  "uk_UA", "ur_PK", "uz_UZ",
  "ve_ZA", "vi_VN",
  "wo_SN",
  "xh_ZA",
  "yi_DE", "yo_NG",
  "zh_CN", "zh_HK", "zh_TW", "zu_ZA", "zz_TR",
]);

/**
 * Convert a locale to a valid Facebook/Open Graph locale.
 *
 * 1. Check bare language codes against known fixes (e.g. "en" -> "en_US")
 * 2. Normalize hyphens to underscores (e.g. "en-GB" -> "en_GB")
 * 3. Expand 2-letter codes to xx_XX format
 * 4. Validate against the full Facebook locale list
 * 5. Fall back to en_US if no valid match
 */
function toOgLocale(locale: string): string {
  // Known bare-code fixes
  if (FIX_LOCALES[locale]) return FIX_LOCALES[locale];

  // Normalize hyphens to underscores
  let normalized = locale.replace("-", "_");

  // Expand bare 2-letter codes to xx_XX
  if (normalized.length === 2) {
    normalized = normalized.toLowerCase() + "_" + normalized.toUpperCase();
  }

  // If it's a valid Facebook locale, use it
  if (VALID_LOCALES.has(normalized)) return normalized;

  // Try deriving xx_XX from the language part
  const lang = normalized.substring(0, 2).toLowerCase();
  const derived = lang + "_" + lang.toUpperCase();
  if (VALID_LOCALES.has(derived)) return derived;

  return "en_US";
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
