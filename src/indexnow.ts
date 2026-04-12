import {
  generateIndexNowKey,
  getIndexNowKeyFileContent,
  submitToIndexNow,
  validateIndexNowKey,
} from "@jdevalk/seo-graph-core";
import type { PluginContext } from "emdash";
import { buildPageUrl } from "./urls.js";

const KEY_KV = "indexnow:key";
const ENABLED_KV = "settings:indexnowEnabled";

/**
 * Read or lazily generate the IndexNow key. The key is persisted in plugin
 * KV so subsequent submissions (and the key-file route exposed on the
 * Astro front-end) use the same value. Key rotation is a manual action:
 * delete the KV entry and the next call will mint a new one.
 */
export async function getOrCreateIndexNowKey(ctx: PluginContext): Promise<string> {
  const existing = await ctx.kv.get(KEY_KV);
  if (typeof existing === "string" && validateIndexNowKey(existing)) {
    return existing;
  }
  const key = generateIndexNowKey(32);
  await ctx.kv.set(KEY_KV, key);
  return key;
}

/** True when the admin has opted in via the settings toggle. */
export async function isIndexNowEnabled(ctx: PluginContext): Promise<boolean> {
  const raw = await ctx.kv.get(ENABLED_KV);
  if (raw === true) return true;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return false;
}

/**
 * Build the canonical URL for a published content item using the
 * collection's `urlPattern`. Returns `null` when the collection has no
 * pattern or the content lacks a slug (e.g. unpublished draft without a
 * resolvable URL).
 */
async function urlForContent(
  content: Record<string, unknown>,
  collection: string,
  siteUrl: string,
): Promise<string | null> {
  const slug = typeof content.slug === "string" ? content.slug : null;
  if (!slug) return null;

  const { getCollectionInfo, getI18nConfig, isI18nEnabled } = await import("emdash");

  let info;
  try {
    info = await getCollectionInfo(collection);
  } catch {
    return null;
  }
  if (!info?.urlPattern) return null;

  const locale =
    typeof content.locale === "string" && content.locale ? content.locale : null;

  // Non-i18n sites: fall back to a minimal pattern substitution that
  // doesn't require an I18nConfig. buildPageUrl demands a cfg, so fake a
  // single-locale config when i18n is disabled.
  const cfg =
    isI18nEnabled() && getI18nConfig()
      ? getI18nConfig()!
      : {
          locales: [locale ?? "en"],
          defaultLocale: locale ?? "en",
          prefixDefaultLocale: false,
        };

  return buildPageUrl({
    locale: locale ?? cfg.defaultLocale,
    slug,
    siteUrl,
    cfg,
    urlPattern: info.urlPattern,
  });
}

/**
 * Handler for `content:afterPublish` and `content:afterUnpublish`.
 * Submits the transitioned URL to IndexNow so participating engines
 * recrawl and pick up the new state (including 410/404 for unpublished
 * content). Fire-and-forget: never throws, logs errors on ctx.log.
 */
export async function handleIndexNowTransition(
  event: { content: Record<string, unknown>; collection: string },
  ctx: PluginContext,
): Promise<void> {
  try {
    if (!(await isIndexNowEnabled(ctx))) return;

    const siteUrl = ctx.site.url;
    if (!siteUrl) return;

    const url = await urlForContent(event.content, event.collection, siteUrl);
    if (!url) return;

    let host: string;
    try {
      host = new URL(siteUrl).hostname;
    } catch {
      return;
    }

    const key = await getOrCreateIndexNowKey(ctx);

    const results = await submitToIndexNow({
      host,
      key,
      urls: [url],
    });

    for (const r of results) {
      if (r.ok) {
        ctx.log.info("IndexNow: submitted", { url, status: r.status });
      } else {
        ctx.log.warn("IndexNow: submission failed", {
          url,
          status: r.status,
          message: r.message,
        });
      }
    }
  } catch (error) {
    ctx.log.warn("IndexNow: transition handler error", { error });
  }
}

/** Returns the plain-text body to serve at `/<key>.txt`. */
export async function getKeyFileBody(ctx: PluginContext): Promise<string> {
  const key = await getOrCreateIndexNowKey(ctx);
  return getIndexNowKeyFileContent(key);
}
