# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
