# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-04-09

### Changed

- Bump `@jdevalk/seo-graph-core` range from `^0.1.0` to `^0.2.0` to pick up the new core release. `seo-graph-core@0.2.0` adds a generic type parameter to `buildOrganization` (flows schema-dts subtype autocomplete into the `extra` field) and makes `WebPageInput.breadcrumb` optional. Both improvements are additive; this plugin doesn't currently call those piece builders directly, but the bump keeps the installed `seo-graph-core` version in sync with what `@jdevalk/astro-seo-graph@^0.2.1` pulls in, avoiding duplicate `seo-graph-core` copies in `node_modules`.

## [0.4.0] - 2026-04-09

### Added

- **hreflang alternates for multilingual sites.** When EmDash's Astro `i18n` config defines multiple locales and content entries are linked via `translation_group`, the plugin now emits one `<link rel="alternate" hreflang="…" href="…">` per published sibling plus an automatically-resolved `x-default` entry. Self-referential entries are included. URLs are built from each collection's `urlPattern` + the locale's Astro prefix rules, so every hreflang target matches the canonical URL of that page.
- **Region-tag hreflang output.** BCP 47 tags are normalized on emission: `fr-ca` becomes `fr-CA`, `zh-hant-hk` becomes `zh-Hant-HK`. Sites that need `fr-CA` vs `fr-FR` as separate translations should use the code as the locale path (`locales: ["en", "fr-ca", "fr-fr"]` in `astro.config.mjs`), since EmDash core currently drops Astro's object-form `{ path, codes }` shape.
- **`buildPageUrl` helper (`src/urls.ts`).** Shared path-construction logic honoring `urlPattern`, `prefixDefaultLocale`, and the plugin's canonical-normalization rules (lowercase, collapsed slashes, trailing slash).

### Changed

- **Runtime dependency on [`@jdevalk/astro-seo-graph`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph).** The hreflang work reuses `buildAlternateLinks` from `astro-seo-graph` for normalization, dedup, and `x-default` resolution. The helper is pure TypeScript, so this does not add any Astro runtime overhead — Astro is a peer dep satisfied transitively through EmDash.

### Notes

Zero cost on single-locale sites: gated on `isI18nEnabled()` before any database call. When i18n is disabled, the hreflang path is a single boolean check and an early return.

## [0.3.0] - 2026-04-09

### Added

- **BreadcrumbList schema**. Every non-homepage, non-404 page now emits a `BreadcrumbList` entity in the schema graph, with a matching `breadcrumb: { "@id": ... }` back-reference on the `WebPage` node. Two override layers:
  - **Segment labels** — a settings-level `segment → display label` map (editable in the admin UI under _Breadcrumbs → Segment labels_). Overrides the default title-cased segment name wherever that segment appears in a path. Example: `blog → Blog` relabels `/blog/` on every post under it.
  - **Page type rules** — a settings-level `pageType → ordered crumb list` map (editable in the admin UI under _Breadcrumbs → Page type rules_). Advanced, JSON-edited. Each crumb is `{ label, href? }` where `label` may contain the `{title}` placeholder and an omitted `href` resolves to the current canonical URL.
- **Default path derivation** — when no rule matches, breadcrumbs are derived from `page.path` by walking segments, applying the label map or title-casing dashes, skipping numeric year/month segments (`/2025/`) and `page/N` pagination, and always using `page.title` for the final crumb.

### Changed

- **Breaking: `@id` scheme migrated to `makeIds()` from `@jdevalk/seo-graph-core`.** All entity `@id` values now match joost.blog's scheme for consistency across the SEO graph ecosystem. Notable shifts:
  - `WebPage` `@id` is now the canonical URL itself (previously `${url}#webpage`).
  - `WebSite` `@id` is `${site}/#/schema.org/WebSite` (previously `${site}/#website`).
  - `Person` `@id` is `${personUrl}#/schema.org/Person` (previously a name-hashed path). Set the `personUrl` field to relocate to e.g. `/about-me/`.
  - `Organization` `@id` is `${site}/#/schema.org/Organization/${slug}` where `slug` is derived from the configured org name.
  - `isPartOf`/`mainEntityOfPage` references on `Article` updated to point at the new `WebPage` `@id`.
- `buildAuthorPerson` and `buildSiteEntity` now share `ids.person` for Person sites, collapsing what were two near-identical nodes into one via `assembleGraph`'s first-wins dedupe.
- The schema orchestrator constructs a single `IdFactory` once per page and threads it through every piece builder, making `@id` generation testable and consistent.

### Notes

This is a breaking change in the emitted JSON-LD `@id` values. Consumers that depend on specific `@id` strings (custom schema consumers, analytics that index by `@id`) will need to update. The overall graph _shape_ is unchanged — only the identifier strings shift.

## [0.2.0] - 2026-04-09

### Added

- Runtime dependency on [`@jdevalk/seo-graph-core`](https://www.npmjs.com/package/@jdevalk/seo-graph-core) — the shared schema.org graph infrastructure also used by [joost.blog](https://joost.blog) via [`@jdevalk/astro-seo-graph`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph). Both consumers now emit structurally-identical graphs even though they build pieces from very different runtime contexts (EmDash's `PublicPageContext` here, Astro's content collections there).

### Changed

- `src/schema/index.ts` now uses `assembleGraph` from `@jdevalk/seo-graph-core` to wrap the graph, rather than manually constructing the `{ @context, @graph }` envelope. This means both consumers share the same first-wins deduplication semantics out of the box. The individual piece builders (`buildSiteEntity`, `buildWebSite`, `buildWebPage`, `buildArticle`, `buildAuthorPerson`) remain EmDash-specific for now because EmDash's `@id` scheme, Organization-or-Person site entity dispatch, and WebSite SearchAction shape don't map cleanly onto the core's opinionated piece builders.
- Piece builder return types aligned with core's `GraphEntity` type for type consistency across the ecosystem.

### Notes

This release is a minor bump rather than a patch because introducing a runtime dependency is a material change in the plugin's install footprint, even though the JSON-LD output for existing pages is byte-identical to 0.1.3.

## [0.1.0] - 2026-04-03

### Added

- Meta description generation with configurable fallback chain
- Meta robots directives with `max-snippet`, `max-image-preview`, and `max-video-preview`; `noindex` for search/utility pages
- Canonical URL generation — absolute, normalized, with trailing slash and pagination support
- Open Graph tags — `og:title`, `og:type`, `og:image`, `og:url`, `og:description`, `og:site_name`, `og:locale`
- Twitter Card tags — `summary_large_image` with site handle
- JSON-LD schema graph with `Person`/`Organization`, `WebSite` with `SearchAction`, `WebPage`/`CollectionPage`, and `Article` with author
- Admin settings UI auto-generated from `settingsSchema`
- Configurable site identity (Person or Organization), social profiles, title separator, and default description

[0.1.0]: https://github.com/jdevalk/emdash-plugin-seo/releases/tag/v0.1.0
