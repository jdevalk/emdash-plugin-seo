import type { I18nConfig } from "emdash";

/**
 * Build an absolute page URL for a `(locale, slug)` pair inside a
 * collection, honoring Astro's i18n locale-prefix routing rules.
 *
 * This helper is shared between `hreflang.ts` and (indirectly) the
 * canonical module — the URL it produces for a given triple is the
 * canonical URL of that page. The hreflang invariant ("hreflang URL ==
 * canonical URL of target") depends on this being consistent.
 *
 * Supported URL patterns: anything containing `{slug}` as the only
 * placeholder (e.g. `"/{slug}"`, `"/blog/{slug}"`). Patterns without
 * `{slug}`, or with additional placeholders that would remain
 * unsubstituted, return `null` — the caller should skip them.
 */
export interface BuildPageUrlInput {
	locale: string;
	slug: string;
	/** `ctx.site.url` — absolute origin. Trailing slash is tolerated. */
	siteUrl: string;
	cfg: I18nConfig;
	/** e.g. `"/{slug}"` or `"/blog/{slug}"`. */
	urlPattern: string;
}

const UNSUBSTITUTED_PLACEHOLDER_RE = /\{[^}]+\}/;
const MULTI_SLASH_RE = /\/+/g;

export function buildPageUrl(input: BuildPageUrlInput): string | null {
	const { locale, slug, siteUrl, cfg, urlPattern } = input;

	if (!urlPattern.includes("{slug}")) return null;

	// Substitute {slug} into the pattern. Leave other placeholders in
	// place — they'll be caught by the unsubstituted check below.
	let path = urlPattern.replace("{slug}", slug);

	// Reject patterns that still carry unsubstituted placeholders; we
	// don't know what to fill them with.
	if (UNSUBSTITUTED_PLACEHOLDER_RE.test(path)) return null;

	// Astro i18n locale prefixing: prefix with `/{locale}` unless this
	// is the default locale AND `prefixDefaultLocale === false`.
	const shouldPrefix = locale !== cfg.defaultLocale || cfg.prefixDefaultLocale === true;
	if (shouldPrefix) {
		if (!path.startsWith("/")) path = "/" + path;
		path = `/${locale}${path}`;
	}

	// Normalize: ensure leading slash, lowercase, collapse duplicate
	// slashes, enforce trailing slash. This matches canonical.ts's
	// normalization rules — any change here must update canonical.ts
	// (and vice versa) or the hreflang/canonical equality invariant
	// will break.
	if (!path.startsWith("/")) path = "/" + path;
	path = path.toLowerCase().replace(MULTI_SLASH_RE, "/");
	if (!path.endsWith("/")) path += "/";

	// Strip trailing slash from siteUrl before concatenation.
	const origin = siteUrl.replace(/\/+$/, "");

	// Defensive: verify the result is a parseable absolute URL.
	try {
		const url = new URL(`${origin}${path}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.toString();
	} catch {
		return null;
	}
}
