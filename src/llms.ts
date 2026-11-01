import type { PluginContext } from "emdash";
import { buildPageUrl } from "./urls.js";

const ENABLED_KV = "settings:llmsTxtEnabled";

/**
 * A single link entry in an `llms.txt` section.
 *
 * Spec: https://llmstxt.org/ — a list item of form
 * `- [name](url): optional description`.
 */
export interface LlmsTxtEntry {
  title: string;
  url: string;
  description?: string;
}

export interface LlmsTxtBuildOptions {
  /** Heading at the top of the file (H1). */
  siteName: string;
  /** Optional blockquote blurb immediately below the H1. */
  siteDescription?: string;
  /** Ordered map of section heading → entries. Empty sections are skipped. */
  sections: Record<string, LlmsTxtEntry[]>;
}

/**
 * Render an `llms.txt` body from structured input.
 *
 * This is the small-form spec only (H1, optional blockquote, then H2
 * sections of bulleted links). The `-full` variant is intentionally
 * out of scope.
 */
export function buildLlmsTxt(opts: LlmsTxtBuildOptions): string {
  const lines: string[] = [];
  lines.push(`# ${opts.siteName}`, "");
  if (opts.siteDescription) {
    lines.push(`> ${opts.siteDescription}`, "");
  }
  for (const [heading, entries] of Object.entries(opts.sections)) {
    if (!entries.length) continue;
    lines.push(`## ${heading}`, "");
    for (const entry of entries) {
      const desc = entry.description ? `: ${entry.description}` : "";
      lines.push(`- [${entry.title}](${entry.url})${desc}`);
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

/**
 * True when llms.txt generation is active. Enabled by default; flip
 * the setting to `"false"` in the admin to turn it off.
 */
export async function isLlmsTxtEnabled(ctx: PluginContext): Promise<boolean> {
  const raw = await ctx.kv.get(ENABLED_KV);
  if (raw === false) return false;
  if (typeof raw === "string") return !(raw === "false" || raw === "0");
  return true;
}

function humanize(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pull published entries across every collection with a `urlPattern`
 * and assemble an `llms.txt` body.
 *
 * Returns `null` when the feature is disabled. Collections without a
 * `urlPattern` are skipped (no public URL to link to). Within each
 * collection we paginate through `ctx.content.list`, narrowing to
 * `status === "published"` at the database layer via `where`.
 */
export async function generateLlmsTxt(ctx: PluginContext): Promise<string | null> {
  if (!(await isLlmsTxtEnabled(ctx))) return null;
  if (!ctx.content) return null;

  const siteUrl = ctx.site.url;
  if (!siteUrl) return null;

  const { SchemaRegistry, isI18nEnabled, getI18nConfig } = await import("emdash");
  const { getDb } = await import("emdash/runtime");
  const db = await getDb();
  const registry = new SchemaRegistry(db);
  const collections = await registry.listCollections();

  const cfg =
    isI18nEnabled() && getI18nConfig()
      ? getI18nConfig()!
      : { locales: ["en"], defaultLocale: "en", prefixDefaultLocale: false };

  const settings = await ctx.kv.list("settings:");
  const get = (k: string): string => {
    const hit = settings.find((e) => e.key === `settings:${k}`);
    return typeof hit?.value === "string" ? hit.value : "";
  };

  // Prefer the live Site Title setting. `ctx.site.name` reads the one-time
  // `emdash:site_title` value written at first-run setup, so it is missing or
  // stale after an owner renames the site (and on multi-site setups that clone a
  // site without re-running setup). Fall back to the old chain if unavailable.
  let liveTitle: string | undefined;
  try {
    const { getSiteSettings } = await import("emdash");
    const live = (await getSiteSettings()) as { title?: unknown } | null;
    if (typeof live?.title === "string" && live.title.trim()) liveTitle = live.title.trim();
  } catch {
    // getSiteSettings unavailable in this context; fall through to the old chain.
  }
  const siteName = liveTitle || ctx.site.name || get("personName") || get("orgName") || "Site";
  const siteDescription = get("llmsTxtDescription") || get("defaultDescription") || undefined;

  // An llms.txt is a map an agent reads top-down, so order and descriptions matter.
  // These defaults make the file agent-friendly for every site without any config
  // (most plugin users configure nothing), keyed only off slug sets common to CMS
  // sites, so nothing here is site-specific:
  //   - the home/root page is listed FIRST inside its section;
  //   - the home-containing section is emitted first, and boilerplate legal/contact
  //     pages are grouped into one "Legal" section emitted LAST, wherever they live;
  //   - an entry's description falls back to its SEO description when the content has
  //     no description/excerpt field (so a blocks-based homepage still gets a one-liner);
  //   - entries hidden from search (seo.noIndex) are excluded from the file too.
  const LEGAL_SLUGS = new Set([
    "impressum", "imprint", "datenschutz", "datenschutzerklaerung", "privacy", "privacy-policy",
    "agb", "terms", "terms-of-service", "tos", "legal", "cookies", "cookie-policy", "contact",
    "kontakt", "impressum-datenschutz",
  ]);
  const HOME_SLUGS = new Set(["home", "index", "homepage", "start", "startseite"]);
  const LEGAL_HEADING = "Legal";

  interface Row extends LlmsTxtEntry {
    isHome: boolean;
  }
  const bySection = new Map<string, Row[]>();

  for (const collection of collections) {
    if (!collection.urlPattern) continue;

    const heading = collection.label || humanize(collection.slug);
    let cursor: string | undefined;
    do {
      const page = await ctx.content.list(collection.slug, {
        limit: 100,
        cursor,
        where: { status: "published" },
      });
      for (const item of page.items) {
        if (!item.slug) continue;

        // Respect SEO visibility: an entry kept out of search is kept out of llms.txt too.
        const seo = (item as { seo?: Record<string, unknown> }).seo;
        if (seo && seo.noIndex === true) continue;

        const slug = item.slug;
        const locale = item.locale || cfg.defaultLocale;
        const data = item.data as Record<string, unknown>;

        const url = buildPageUrl({
          locale,
          slug,
          siteUrl,
          cfg,
          urlPattern: collection.urlPattern,
        });
        if (!url) continue;

        const title =
          (typeof data.title === "string" && data.title) ||
          (typeof data.name === "string" && data.name) ||
          slug;
        const description =
          (typeof data.description === "string" && data.description) ||
          (typeof data.excerpt === "string" && data.excerpt) ||
          (seo && typeof seo.description === "string" && (seo.description as string).trim()
            ? (seo.description as string)
            : undefined) ||
          undefined;

        const isHome = HOME_SLUGS.has(slug.toLowerCase());
        const target = LEGAL_SLUGS.has(slug.toLowerCase()) ? LEGAL_HEADING : heading;
        const bucket = bySection.get(target) ?? [];
        bucket.push({ title, url, description, isHome });
        bySection.set(target, bucket);
      }
      cursor = page.cursor;
    } while (cursor);
  }

  // Home page floats to the top of its section; others keep stable order.
  for (const rows of bySection.values()) {
    rows.sort((a, b) => (a.isHome === b.isHome ? 0 : a.isHome ? -1 : 1));
  }

  // Emit the home-containing section first, then the rest in natural order, Legal last.
  const headings = [...bySection.keys()];
  const homeHeading = headings.find(
    (h) => h !== LEGAL_HEADING && bySection.get(h)!.some((r) => r.isHome),
  );
  const ordered = [
    ...(homeHeading ? [homeHeading] : []),
    ...headings.filter((h) => h !== LEGAL_HEADING && h !== homeHeading),
    ...(bySection.has(LEGAL_HEADING) ? [LEGAL_HEADING] : []),
  ];

  const sections: Record<string, LlmsTxtEntry[]> = {};
  for (const h of ordered) {
    sections[h] = bySection.get(h)!.map(({ title, url, description }) => ({ title, url, description }));
  }

  return buildLlmsTxt({ siteName, siteDescription, sections });
}
