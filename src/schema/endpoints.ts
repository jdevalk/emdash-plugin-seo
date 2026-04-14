import type { PluginContext } from "emdash";
import { buildPageUrl } from "../urls.js";

/**
 * One entry in the schema map — a URL that has a published content
 * record backing it, with the last-modified timestamp used by crawlers
 * and agents to decide whether to refetch.
 */
export interface SchemaMapEntry {
  /** Absolute URL of the live page. */
  url: string;
  /** Collection slug (e.g. "posts", "pages"). */
  collection: string;
  /** ISO-8601 last-modified timestamp (updatedAt, falling back to createdAt). */
  updatedAt: string;
}

/**
 * Enumerate every published URL the site exposes — the data a
 * `schemamap.xml` endpoint needs.
 *
 * This mirrors `generateLlmsTxt`'s iteration: walk every collection
 * with a `urlPattern`, paginate through `ctx.content.list`, filter to
 * `status === "published"`, and project each item to a `(url,
 * collection, updatedAt)` triple.
 *
 * Returns an empty array (not null) when the site has no publishable
 * content — callers should treat that as "serve an empty but valid
 * schema map," not "404." Collections without a `urlPattern` are
 * silently skipped; they have no public URL to advertise.
 */
export async function listSchemaEntries(ctx: PluginContext): Promise<SchemaMapEntry[]> {
  if (!ctx.content) return [];
  const siteUrl = ctx.site.url;
  if (!siteUrl) return [];

  const { SchemaRegistry, isI18nEnabled, getI18nConfig } = await import("emdash");
  const { getDb } = await import("emdash/runtime");
  const db = await getDb();
  const registry = new SchemaRegistry(db);
  const collections = await registry.listCollections();

  const cfg =
    isI18nEnabled() && getI18nConfig()
      ? getI18nConfig()!
      : { locales: ["en"], defaultLocale: "en", prefixDefaultLocale: false };

  const entries: SchemaMapEntry[] = [];

  for (const collection of collections) {
    if (!collection.urlPattern) continue;

    let cursor: string | undefined;
    do {
      const page = await ctx.content.list(collection.slug, {
        limit: 100,
        cursor,
        where: { status: "published" },
      });
      for (const item of page.items) {
        if (!item.slug) continue;
        const slug = item.slug;
        const locale = item.locale || cfg.defaultLocale;

        const url = buildPageUrl({
          locale,
          slug,
          siteUrl,
          cfg,
          urlPattern: collection.urlPattern,
        });
        if (!url) continue;

        const updatedAt =
          (typeof item.updatedAt === "string" && item.updatedAt) ||
          (typeof item.createdAt === "string" && item.createdAt) ||
          new Date(0).toISOString();

        entries.push({ url, collection: collection.slug, updatedAt });
      }
      cursor = page.cursor;
    } while (cursor);
  }

  return entries;
}
