# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
