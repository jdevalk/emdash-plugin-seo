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

  const siteName = ctx.site.name || get("personName") || get("orgName") || "Site";
  const siteDescription = get("llmsTxtDescription") || get("defaultDescription") || undefined;

  const sections: Record<string, LlmsTxtEntry[]> = {};

  for (const collection of collections) {
    if (!collection.urlPattern) continue;

    const entries: LlmsTxtEntry[] = [];
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
          undefined;

        entries.push({ title, url, description });
      }
      cursor = page.cursor;
    } while (cursor);

    if (entries.length) {
      sections[collection.label || humanize(collection.slug)] = entries;
    }
  }

  return buildLlmsTxt({ siteName, siteDescription, sections });
}
