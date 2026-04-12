# EmDash SEO Plugin

[![CI](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/ci.yml/badge.svg)](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/ci.yml)
[![Lint](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/lint.yml/badge.svg)](https://github.com/jdevalk/emdash-plugin-seo/actions/workflows/lint.yml)
[![npm](https://img.shields.io/npm/v/@jdevalk/emdash-plugin-seo)](https://www.npmjs.com/package/@jdevalk/emdash-plugin-seo)
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
  - `Person` or `Organization` (configurable), with `publishingPrinciples`
  - `WebSite` with `SearchAction` and optional `SiteNavigationElement`
  - `Blog` entity (when blog URL is configured)
  - `WebPage` (`CollectionPage` for archives, `ProfilePage` for `/about`), with `about`, copyright, and license fields
  - `BlogPosting` with author `Person` (for content pages), linked to `Blog` when configured
  - `ImageObject` for primary page images
  - `BreadcrumbList` with a back-reference from `WebPage`
- **Breadcrumbs** — derived from the URL path by default, with segment label overrides (`/blog/` → "Blog") and per-`pageType` rule overrides both editable in the admin UI. `@id` scheme matches [joost.blog](https://joost.blog) via `@jdevalk/seo-graph-core`
- **hreflang alternates** — for multilingual EmDash sites (Astro `i18n` + `translation_group`), one `<link rel="alternate" hreflang="…">` per published sibling plus an automatic `x-default`, with BCP 47 tag normalization (`fr-ca` → `fr-CA`). Zero cost on single-locale sites
- **IndexNow** — on publish/unpublish transitions, submits the affected URL to [IndexNow](https://www.indexnow.org) so Bing, Yandex, Seznam, Naver, and Yep recrawl immediately. Opt-in via a single toggle in the settings UI; the key is generated and persisted automatically on first use
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
| Publishing principles URL | Link to editorial policy page |
| Copyright year | Year copyright was first asserted |
| License URL | Content license (e.g. Creative Commons) |
| Blog URL / name | Enables `Blog` schema entity linked to `BlogPosting` nodes |
| Navigation items | JSON array of `{name, url}` for `SiteNavigationElement` schema |
| Breadcrumb segment labels | `segment → display label` overrides (e.g. `blog → Blog`) |
| Breadcrumb page type rules | Per-`pageType` ordered crumb lists, JSON-edited, for themes that need full control over trail shape |
| IndexNow submission | Submit published/unpublished URLs to IndexNow. Disabled by default |

## Multilingual sites (hreflang)

When your site has more than one locale configured in Astro's `i18n` block and content entries are linked via `translation_group`, the plugin automatically emits hreflang annotations for each content page. No configuration required — it activates as soon as `isI18nEnabled()` returns true.

```js
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "nl"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [emdash({ plugins: [seoPlugin()] })],
});
```

A 3-locale post at `/hello/`, with published French (`/fr/bonjour/`) and Dutch (`/nl/hallo/`) translations in the same `translation_group`, renders:

```html
<link rel="alternate" hreflang="en"        href="https://example.com/hello/">
<link rel="alternate" hreflang="fr"        href="https://example.com/fr/bonjour/">
<link rel="alternate" hreflang="nl"        href="https://example.com/nl/hallo/">
<link rel="alternate" hreflang="x-default" href="https://example.com/hello/">
```

Only published siblings are included. Drafts, scheduled entries, and siblings whose locale is no longer in your Astro config are dropped. If the page has fewer than two published locales, no hreflang tags are emitted (a single-locale page has no meaningful alternates).

### Region-specific locales (`fr-CA` vs `fr-FR`)

If you need region-specific hreflang, use the BCP 47 code as the locale path directly:

```js
i18n: {
  defaultLocale: "en",
  locales: ["en", "fr-ca", "fr-fr"],
}
```

URLs become `/fr-ca/…` and `/fr-fr/…`, and the emitted `hreflang` attributes are normalized to conventional casing (`fr-CA`, `fr-FR`). EmDash core currently drops Astro's object-form `{ path, codes }` shape at the integration boundary, so the code-as-path workaround is the supported path for region tags in this plugin version.

## IndexNow

When enabled via the **IndexNow submission** setting, the plugin submits
the canonical URL of any content item that transitions to or from
published. A 32-character hex key is minted on first use and persisted in
plugin KV.

The front-end Astro site must serve the key-verification file at
`/<key>.txt`. Fetch the key from the plugin's `indexnow/key` route and
wire a route on the Astro side using
[`createIndexNowKeyRoute`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph):

```ts
// src/pages/[your-key-here].txt.ts
import { createIndexNowKeyRoute } from '@jdevalk/astro-seo-graph';

export const GET = createIndexNowKeyRoute({ key: 'your-key-here' });
```

> **Deploy the key file before enabling the toggle.** IndexNow verifies
> host ownership on every submission by fetching
> `https://<host>/<key>.txt`. Submissions sent before the key file is
> reachable in production are rejected (HTTP 403) and the key gets
> marked invalid — you'll have to delete the stored key from plugin KV
> and mint a new one. Ship the Astro route, deploy, confirm the `.txt`
> loads over HTTPS, *then* flip the **IndexNow submission** toggle.

When rejections occur, the plugin logs on `ctx.log.warn` but does not
throw — transitions still succeed locally.

## Requirements

Requires EmDash with support for running `page:metadata` hooks on public pages for anonymous visitors (fixed in [emdash-cms/emdash#119](https://github.com/emdash-cms/emdash/pull/119)).

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](https://github.com/jdevalk/.github/blob/main/CONTRIBUTING.md) for guidelines.

If you find a security vulnerability, please follow the [security policy](SECURITY.md) instead of opening a public issue.

## License

MIT — see [LICENSE](LICENSE) for details.
