import type { I18nConfig } from "emdash";

/**
 * How a generated URL should treat its trailing slash. Mirrors Astro's
 * `trailingSlash` config (`'always' | 'never' | 'ignore'`) so the URLs this
 * plugin advertises (sitemap `schema/map`, `llms.txt`, canonical, hreflang,
 * IndexNow) match what the site actually serves. This matters especially for
 * headless consumers, whose front-end may not use Astro's default trailing
 * slash — `ctx.site.trailingSlash` carries the site's configured value.
 */
export type TrailingSlash = "always" | "never" | "ignore";

const TRAILING_SLASHES_RE = /\/+$/;

/**
 * Apply a trailing-slash policy to a path.
 *
 * - `"never"` strips any trailing slash (except the site root `"/"`).
 * - `"always"`, `"ignore"`, or `undefined` keep/add the trailing slash — the
 *   historical behaviour, preserved so existing Astro-served sites are
 *   unchanged. (`"ignore"` maps to "keep" because a sitemap/canonical URL must
 *   commit to a single form, and the trailing-slash form is the pre-existing
 *   one; a site that wants the bare form sets `trailingSlash: "never"`.)
 *
 * The site root is always `"/"` regardless of policy.
 */
export function applyTrailingSlash(path: string, mode: TrailingSlash | undefined): string {
	if (path === "/") return path;
	if (mode === "never") return path.replace(TRAILING_SLASHES_RE, "");
	return path.endsWith("/") ? path : `${path}/`;
}

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
	/**
	 * Trailing-slash policy for the emitted URL, from `ctx.site.trailingSlash`
	 * (Astro's `trailingSlash` config). Defaults to keeping the trailing slash,
	 * so behaviour is unchanged when the site doesn't set it.
	 */
	trailingSlash?: TrailingSlash;
}

const UNSUBSTITUTED_PLACEHOLDER_RE = /\{[^}]+\}/;
const MULTI_SLASH_RE = /\/+/g;

export function buildPageUrl(input: BuildPageUrlInput): string | null {
	const { locale, slug, siteUrl, cfg, urlPattern, trailingSlash } = input;

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

	// Normalize: ensure leading slash, lowercase, collapse duplicate slashes,
	// then apply the site's trailing-slash policy. This matches canonical.ts's
	// normalization (both use `applyTrailingSlash`) — the hreflang/canonical
	// equality invariant depends on the two staying in sync.
	if (!path.startsWith("/")) path = "/" + path;
	path = path.toLowerCase().replace(MULTI_SLASH_RE, "/");
	path = applyTrailingSlash(path, trailingSlash);

	// Strip trailing slash from siteUrl before concatenation.
	const origin = siteUrl.replace(TRAILING_SLASHES_RE, "");

	// Defensive: verify the result is a parseable absolute URL.
	try {
		const url = new URL(`${origin}${path}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.toString();
	} catch {
		return null;
	}
}
