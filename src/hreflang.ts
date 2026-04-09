import { buildAlternateLinks } from "@jdevalk/astro-seo-graph";
import type {
  I18nConfig,
  PageMetadataContribution,
  PluginContext,
  PublicPageContext,
} from "emdash";

import { buildPageUrl } from "./urls.js";

/**
 * Thin EmDash adapter around `@jdevalk/astro-seo-graph`'s
 * `buildAlternateLinks`.
 *
 * Sources translation data via EmDash's public API
 * (`getTranslations`, `getI18nConfig`, `getCollectionInfo`), constructs
 * per-locale absolute URLs with the shared `buildPageUrl` helper, and
 * hands off to `buildAlternateLinks` for normalization, dedup, and
 * x-default resolution.
 *
 * Returns `[]` under any of these conditions:
 * - i18n is not enabled (single-locale site)
 * - the current page is not a content entry
 * - fewer than 2 published siblings exist (no alternates to link)
 * - the current entry is not in its own translation group (data bug)
 * - the collection has no `urlPattern` (cannot build URLs)
 * - any transient failure (e.g. `getTranslations` throws)
 */
export async function generateHreflang(
	page: PublicPageContext,
	ctx: PluginContext,
	siteUrl: string,
): Promise<PageMetadataContribution[]> {
	// Dynamically import emdash to keep this module testable via
	// `vi.mock("emdash", ...)` — the alternative is top-level imports
	// that vitest then has to intercept, which works but makes mocks
	// brittle. Dynamic import lets each test replace the module cleanly.
	const { isI18nEnabled, getI18nConfig, getTranslations, getCollectionInfo } =
		await import("emdash");

	if (!isI18nEnabled()) return [];
	if (page.kind !== "content" || !page.content) return [];

	const cfg: I18nConfig | null = getI18nConfig();
	if (!cfg) return [];

	let result;
	try {
		result = await getTranslations(page.content.collection, page.content.id);
	} catch (error) {
		ctx.log.warn("hreflang: getTranslations failed", { error });
		return [];
	}
	if (result.error !== undefined) return [];
	if (result.translations.length < 2) return [];

	// Data-integrity guard: the current entry must appear in its own
	// translation group. If not, something is wrong upstream — don't
	// emit partial or incorrect annotations.
	const currentInGroup = result.translations.some((t) => t.id === page.content!.id);
	if (!currentInGroup) return [];

	let collection;
	try {
		collection = await getCollectionInfo(page.content.collection);
	} catch (error) {
		ctx.log.warn("hreflang: getCollectionInfo failed", { error });
		return [];
	}
	if (!collection?.urlPattern) return [];
	const urlPattern = collection.urlPattern;

	const entries: Array<{ hreflang: string; href: string }> = [];
	for (const t of result.translations) {
		if (t.status !== "published") continue;
		if (!t.slug) continue;
		if (!cfg.locales.includes(t.locale)) continue;

		const href = buildPageUrl({
			locale: t.locale,
			slug: t.slug,
			siteUrl,
			cfg,
			urlPattern,
		});
		if (href === null) continue;

		entries.push({ hreflang: t.locale, href });
	}

	const alternates = buildAlternateLinks({
		entries,
		defaultLocale: cfg.defaultLocale,
	});

	return alternates.map((a) => ({
		kind: "link" as const,
		rel: "alternate" as const,
		href: a.href,
		hreflang: a.hreflang,
		key: `hreflang:${a.hreflang}`,
	}));
}
