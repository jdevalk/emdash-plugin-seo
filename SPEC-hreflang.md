# Spec: hreflang adapter for multilingual EmDash sites

Status: draft
Owner: `@jdevalk/emdash-plugin-seo`
Depends on: `@jdevalk/astro-seo-graph` (new dep) — see `seo-graph/packages/astro-seo-graph/SPEC-alternates.md` for the shared helper
New files: `src/hreflang.ts`, `src/urls.ts`, `test/hreflang.test.ts`
Modified files: `src/metadata.ts`, `src/canonical.ts`, `package.json`

## Problem

EmDash supports multilingual content via Astro's `i18n` config and a `translation_group` ULID shared across locale siblings (core migration `019_i18n.ts`). It exposes `getTranslations(type, id)` and `getI18nConfig()` in the public `emdash` API, and it accepts `<link rel="alternate" hreflang="…">` contributions through the `page:metadata` hook.

Nothing in EmDash core emits those tags automatically. A multilingual EmDash site ships without hreflang annotations unless the site author writes them by hand in a layout.

This plugin already owns page-level SEO metadata for EmDash (canonical, OG, JSON-LD via `src/metadata.ts`). Hreflang is in scope.

## Goal

When `seoPlugin` is installed on a site with Astro `i18n` configured and content that uses `translation_group`, emit a complete, correct set of `<link rel="alternate" hreflang="…">` tags in `<head>` for every content page that has translations, including an `x-default` entry and a self-referential entry for the current page.

## Non-goals

- **Rendering logic.** URL normalization, BCP 47 tag casing, `x-default` selection, dedup, and absolute-URL enforcement live in `@jdevalk/astro-seo-graph`'s `buildAlternateLinks` helper. This plugin is a thin adapter.
- **Custom (non-content) pages.** They aren't in a `translation_group`. Site owners own their routing.
- **Sitemap hreflang.** Separate concern.
- **Emitting hreflang for draft/scheduled/unpublished translations.** Only `status === "published"` siblings count.
- **BCP 47 region-tag distinction (`fr` vs `fr-CA`) via the Astro object-form locale.** See "Region tag limitation" below.

## Architecture

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  emdash-plugin-seo            │       │  astro-seo-graph             │
│                               │       │                              │
│  hreflang.ts                  │       │  alternates.ts               │
│   - generateHreflang()        │──────▶│   - buildAlternateLinks()    │
│     - calls getTranslations() │       │     (pure, normalizes tags,  │
│     - calls getI18nConfig()   │       │      adds x-default,         │
│     - builds per-locale URLs  │       │      validates URLs)         │
│       via buildPageUrl()      │       │                              │
│     - feeds to helper         │       │                              │
│   - wraps output as           │       │                              │
│     PageMetadataContribution  │       │                              │
│                               │       │                              │
│  urls.ts                      │       │                              │
│   - buildPageUrl()            │       │                              │
│     (shared by canonical.ts)  │       │                              │
└──────────────────────────────┘       └──────────────────────────────┘
```

The plugin's responsibility is **data sourcing and URL construction**. The helper's responsibility is **normalization, validation, and x-default**. Don't duplicate rules across the boundary.

## Behaviour spec

### 1. Activation conditions

Emit hreflang contributions only when **all** of the following hold:

1. `isI18nEnabled()` returns `true` (there's more than one locale configured).
2. `event.page.kind === "content"` and `event.page.content` is defined.
3. `getTranslations(collection, id)` returns at least **two** published siblings (including the current entry). The shared helper also short-circuits on `entries.length < 2`, but gating here avoids the DB round-trip on single-locale pages.
4. The current page itself is `status === "published"`. Don't leak alternate URLs for draft previews.

If any condition fails, return `[]`. Do not log, do not warn — multilingual-off is the common case.

### 2. Sibling filtering

From `getTranslations()`:

- Keep only `status === "published"`.
- Keep only entries whose `locale` is present in `i18nConfig.locales`. Defensive: drop siblings whose stored locale is no longer in the active Astro config.
- Keep only entries with a non-null `slug`.
- **Always include the current page itself.** Self-referential hreflang is required by Google.
- **Verify the current entry is in the returned list.** If not, that signals a translation-group data integrity issue — return `[]` rather than emitting partial annotations.

### 3. URL construction per sibling

Extract a `buildPageUrl` helper into `src/urls.ts`. Signature:

```ts
import type { I18nConfig } from "emdash";

export function buildPageUrl(input: {
    collection: string;
    locale: string;
    slug: string;
    siteUrl: string;        // from ctx.site.url
    cfg: I18nConfig;        // from getI18nConfig()
    urlPattern: string;     // collection's urlPattern, e.g. "/{slug}" or "/blog/{slug}"
}): string;
```

Rules:

1. Substitute `{slug}` into `urlPattern` to get the locale-less path (e.g. `/blog/hello/`).
2. Prepend the locale prefix:
   - If `locale === cfg.defaultLocale` and `cfg.prefixDefaultLocale === false`: no prefix. The path stays at `/blog/hello/`.
   - Otherwise: prefix is `/{locale}`. Result: `/fr/blog/bonjour/`.
3. Normalize: lowercase, collapse duplicate slashes, enforce trailing slash. This must match `canonical.ts`'s existing normalization exactly — that's why it's a shared helper, not two copies.
4. Combine with `siteUrl` (strip trailing slash from siteUrl first) to produce an absolute URL.

**`canonical.ts` must be refactored to call `buildPageUrl` too.** The current `canonical.ts` (`src/canonical.ts:29-42`) reimplements URL building from `page.url`. After the refactor, both canonical and hreflang produce byte-identical URLs for any `(collection, locale, slug)` triple. This is the single most important invariant — Google silently invalidates hreflang annotations where the hreflang URL doesn't match the target page's canonical.

Lock this with a test (see §6).

### 4. Calling the shared helper

With the filtered sibling list and URLs in hand:

```ts
import { buildAlternateLinks } from "@jdevalk/astro-seo-graph";
import type { PageMetadataContribution, PublicPageContext, PluginContext } from "emdash";
import { getI18nConfig, isI18nEnabled, getTranslations } from "emdash";
import { buildPageUrl } from "./urls.js";

export async function generateHreflang(
    page: PublicPageContext,
    ctx: PluginContext,
    siteUrl: string,
): Promise<PageMetadataContribution[]> {
    if (!isI18nEnabled()) return [];
    if (page.kind !== "content" || !page.content) return [];

    const cfg = getI18nConfig();
    if (!cfg) return [];

    let result;
    try {
        result = await getTranslations(page.content.collection, page.content.id);
    } catch (error) {
        ctx.logger?.warn?.("[seo] getTranslations failed", { error });
        return [];
    }
    if (result.error || result.translations.length < 2) return [];

    const currentInList = result.translations.some((t) => t.id === page.content!.id);
    if (!currentInList) return [];

    const urlPattern = await loadUrlPattern(ctx, page.content.collection);
    if (!urlPattern) return [];

    const entries = result.translations
        .filter((t) => t.status === "published" && t.slug && cfg.locales.includes(t.locale))
        .map((t) => ({
            hreflang: t.locale,
            href: buildPageUrl({
                collection: page.content!.collection,
                locale: t.locale,
                slug: t.slug!,
                siteUrl,
                cfg,
                urlPattern,
            }),
        }));

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
```

The explicit `key: "hreflang:..."` prefix avoids collision with any future `rel="alternate"` contribution from another module (e.g. RSS discovery).

### 4a. Loading `urlPattern`

`PublicPageContext.content` exposes `{ collection, id, slug }` but not `urlPattern`. The plugin needs to look it up. Options:

- **Cache via `ctx.kv`.** Load all `_emdash_collections` rows once, cache by collection slug. Invalidate on schema changes (or just accept eventual consistency — urlPatterns change rarely).
- **Direct query via EmDash's public API.** If EmDash exposes a `getCollectionMeta(slug)` API, use it. Check `packages/core/src/index.ts` at implementation time.
- **Pass-through from page context.** Propose adding `urlPattern` to `PublicPageContext.content` in EmDash core. Cleanest long-term, but requires a core change.

v1 goes with the `ctx.kv` cache. Plugin-local, no core change required.

### 5. Wiring in `metadata.ts`

After the canonical contribution (current `src/metadata.ts:44-47`):

```ts
// 5b. hreflang alternates (multilingual content sites only)
const hreflangContributions = await generateHreflang(page, ctx, siteUrl);
contributions.push(...hreflangContributions);
```

`metadataHandler` is already `async`. No changes to its signature.

### 6. Failure modes

- **`getTranslations()` throws or returns `{ error }`:** swallow, log via `ctx.logger?.warn?.`, return `[]`. SEO metadata must never crash page rendering.
- **`buildAlternateLinks` drops all entries (malformed URLs):** it returns `[]`, so the plugin also returns `[]`. No action needed.
- **Missing `content` on the page context:** return `[]`.
- **Current entry not in translation list:** return `[]`.
- **`urlPattern` missing for the collection:** return `[]`. Log at debug — collections without `urlPattern` genuinely have no canonical URL, so there's nothing to emit.

### 7. Reciprocity

Hreflang requires each sibling to point back with hreflang. Because `getTranslations()` returns the same group from any sibling, running this plugin on every page in the group automatically produces reciprocal annotations. Lock this with a reciprocity test (see §9).

## Settings surface

**No settings in v1.** hreflang is either correct or wrong — there are no meaningful toggles. Site owners who want to disable it can disable the SEO plugin entirely.

Deferred: per-locale URL overrides for sites that rewrite URLs outside Astro routing. Not needed for any known EmDash use case.

## Region tag limitation (`fr` vs `fr-CA`)

**EmDash cannot currently distinguish `fr` from `fr-CA` via Astro's object-form locale definition.** The integration at `packages/core/src/astro/integration/index.ts:180` flattens Astro's `{ path, codes }` locale entries to just the `path` string:

```ts
locales: astroConfig.i18n.locales.map((l) => (typeof l === "string" ? l : l.path)),
```

The `codes` array is dropped. So `{ path: "fr", codes: ["fr-CA", "fr-FR"] }` arrives at the plugin as just `"fr"`, and there is no round-trip path from Astro's `codes` back into `hreflang` output.

### Workaround

Sites needing region-specific hreflang should use the BCP 47 code as the locale path directly:

```js
// astro.config.mjs
i18n: {
    defaultLocale: "en",
    locales: ["en", "fr-ca", "fr-fr"],
    routing: { prefixDefaultLocale: false },
}
```

- URLs become `/fr-ca/…` and `/fr-fr/…`.
- Stored `locale` on content rows is `"fr-ca"` / `"fr-fr"`.
- `buildAlternateLinks` normalizes on output: `fr-ca` → `fr-CA` in the hreflang attribute.
- `getTranslations()` correctly treats them as separate translation groups.

Cost: the URL carries a visible region code. Fine for most sites.

### Proper fix (core change, out of scope for this plugin)

Expand EmDash's virtual module shape to preserve `codes`:

```ts
locales: Array<{ path: string; codes?: readonly string[] }>
```

Then resolve the emitted hreflang code per request from `Accept-Language` or a content-level override. This requires changes to:

- `packages/core/src/astro/integration/index.ts:178-184` — preserve `codes`.
- `packages/core/src/i18n/config.ts` — widen `I18nConfig.locales` type.
- `packages/core/src/astro/middleware/request-context.ts:73` — optionally resolve region from `Accept-Language`.
- Admin manifest at `packages/core/src/emdash-runtime.ts:1301-1306` — expose `codes` for the admin locale switcher.

**Do not attempt this from the plugin side.** File an EmDash discussion if a site owner asks for it.

## Tests

File: `test/hreflang.test.ts`.

### Unit tests for `generateHreflang`

Mock `getTranslations`, `isI18nEnabled`, `getI18nConfig`, and `buildPageUrl`. Use a fake `PluginContext` and `PublicPageContext`.

1. **i18n disabled** → returns `[]`, no DB call.
2. **`page.kind === "custom"`** → `[]`.
3. **Missing `page.content`** → `[]`.
4. **`getTranslations` throws** → `[]`, warning logged.
5. **`getTranslations` returns `{ error }`** → `[]`.
6. **Only one published sibling (self)** → `[]`.
7. **Current entry not in returned translation list** → `[]`.
8. **Three published siblings, `prefixDefaultLocale: false`, default `en`** → 4 contributions (3 locales + x-default). Assert URLs, hreflang codes, `key` values, all absolute.
9. **Three published siblings, `prefixDefaultLocale: true`** → default-locale URL also carries `/en/` prefix. `x-default` matches the `en` URL.
10. **Draft + published siblings** → drafts excluded from entries.
11. **Sibling with null slug** → excluded.
12. **Sibling with locale not in `cfg.locales`** → excluded.
13. **`urlPattern` missing for collection** → `[]`.
14. **BCP 47 region tags (`fr-ca`, `fr-fr`) as locale paths** → hreflang emitted as `fr-CA`, `fr-FR`.

### Reciprocity test

Set up three fake siblings in the same translation group (en/fr/nl), run `generateHreflang` as if each were the current page, assert:

- Each output contains the same set of URLs (ignoring order and x-default).
- Each output contains every locale's hreflang.
- Each output's `x-default` URL matches across all three runs.

This is the real-world invariant search engines check.

### URL-correctness test (canonical ↔ hreflang)

For a given `(collection, locale, slug)`, assert that the URL produced by `generateCanonical` (refactored to call `buildPageUrl`) and the URL produced by `generateHreflang` for that same sibling are byte-identical. Run for:

- Default locale without prefix.
- Default locale with prefix.
- Non-default locale.
- Collection with multi-segment `urlPattern` (`/blog/{slug}`).
- Collection with root `urlPattern` (`/{slug}`).

This test is what prevents the most common hreflang bug in the wild.

## Dependency update

Add to `package.json`:

```json
"dependencies": {
    "@jdevalk/astro-seo-graph": "^0.2.0",
    "@jdevalk/seo-graph-core": "^0.1.0-alpha.0"
}
```

`@jdevalk/astro-seo-graph`'s main entry is pure TypeScript (astro is only a peer dep), so importing `buildAlternateLinks` does not drag in any Astro runtime. EmDash plugin consumers already have `astro` installed via EmDash itself, so the peer dep is satisfied transitively.

## Acceptance criteria

- [ ] `@jdevalk/astro-seo-graph@^0.2.0` added as a dependency.
- [ ] `src/urls.ts` exists and exports `buildPageUrl`.
- [ ] `src/canonical.ts` refactored to call `buildPageUrl` (no behaviour change to existing canonical output — lock with snapshot tests first).
- [ ] `src/hreflang.ts` exists and exports `generateHreflang`.
- [ ] `src/metadata.ts` calls `generateHreflang` and spreads the result after the canonical contribution.
- [ ] All 14 unit tests above pass.
- [ ] Reciprocity test passes for a 3-locale fixture.
- [ ] URL-correctness test passes for all 5 configurations.
- [ ] Manual check on a demo site with `en` / `fr` / `nl` content: view-source on `/hello/` shows 3 `rel="alternate"` entries + `x-default`, all absolute, all pointing at URLs that return 200 on the site.
- [ ] Plugin behaviour on a non-multilingual site is unchanged (zero hreflang tags emitted, zero extra DB queries — guarded by `isI18nEnabled()` before any `getTranslations` call).
- [ ] README gains a "hreflang" section documenting the `fr` vs `fr-CA` workaround.

## Open questions

1. **`urlPattern` access.** Is there a cleaner path than caching via `ctx.kv`? Investigate whether EmDash core exposes a public collection-metadata API at implementation time. If yes, use it. If no, the `ctx.kv` cache is fine for v1.

2. **Refactor scope for `canonical.ts`.** The refactor to call `buildPageUrl` is strictly necessary for correctness (canonical must equal hreflang target). Lock existing canonical output with a snapshot test *before* refactoring. If snapshots change, the existing `canonical.ts` is subtly different from the new shared helper and we have a bug to file, not ignore.

3. **Should the plugin emit hreflang when there's only one published sibling after filtering out drafts?** Current spec says no (short-circuit at count < 2). Alternative: still emit a self-referential hreflang for SEO consistency. Google's guidance is "only emit hreflang when there are real alternates", so `[]` is correct, but worth confirming against a multilingual demo.
