# EmDash SEO Plugin

[![CI](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/ci.yml/badge.svg)](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/ci.yml)
[![Lint](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/lint.yml/badge.svg)](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/lint.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg)](https://www.typescriptlang.org/)
[![EmDash Plugin](https://img.shields.io/badge/EmDash-plugin-orange.svg)](https://github.com/emdash-cms/emdash)

An SEO plugin for [EmDash CMS](https://github.com/emdash-cms/emdash) that generates meta tags, Open Graph, Twitter Cards, canonical URLs, robots directives, and JSON-LD schema markup via the `page:metadata` hook.

## Features

- **Meta descriptions** with configurable fallback chain
- **Meta robots** with `max-snippet`, `max-image-preview`, and `max-video-preview` directives; `noindex` for search/utility pages; omitted on 404
- **Canonical URLs** — absolute, normalized, with trailing slash and pagination support
- **Open Graph** — `og:title` without site name suffix, `og:type: article` for content pages, full set of OG tags
- **Twitter Cards** — `summary_large_image` when image present, site handle from settings
- **JSON-LD schema graph** with linked nodes:
  - `Person` or `Organization` (configurable)
  - `WebSite` with `SearchAction`
  - `WebPage` (`CollectionPage` for archives)
  - `Article` with author `Person` (for content pages)
- **Admin settings UI** — auto-generated from `settingsSchema` for configuring Person/Organization identity, social profiles, title separator, and default description

## Installation

Copy the `src/` directory into your EmDash theme's `plugins/seo/` directory, or install from this repo:

```bash
# In your emdash theme directory
cp -r path/to/emdash-plugin-seo/src plugins/seo/src
cp path/to/emdash-plugin-seo/package.json plugins/seo/package.json
```

## Usage

Register the plugin in your `astro.config.mjs`:

```typescript
import { seoPlugin } from "./plugins/seo/src/index.ts";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [seoPlugin()],
    }),
  ],
});
```

Then configure your site identity and social profiles in the EmDash admin under **Plugins > SEO > Settings**.

## Settings

| Setting | Description |
|---------|-------------|
| Site represents | Person or Organization |
| Title separator | Character between page title and site name (em dash, pipe, hyphen, dot) |
| Default meta description | Fallback for pages without their own |
| Person name / bio / image / job title / URL | Person schema fields |
| Organization name / logo URL | Organization schema fields |
| Social URLs | Twitter/X, Facebook, LinkedIn, Instagram, YouTube, GitHub, Bluesky, Mastodon, Wikipedia |

## Requirements

Requires EmDash with support for running `page:metadata` hooks on public pages for anonymous visitors. See [emdash-cms/emdash#166](https://github.com/emdash-cms/emdash/issues/166) and [PR #169](https://github.com/emdash-cms/emdash/pull/169).

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](https://github.com/jdevalk/.github/blob/main/CONTRIBUTING.md) for guidelines.

If you find a security vulnerability, please follow the [security policy](SECURITY.md) instead of opening a public issue.

## License

MIT — see [LICENSE](LICENSE) for details.
