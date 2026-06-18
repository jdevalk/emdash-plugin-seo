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
 * Maps a content record's `id` to the canonical URL it was last published
 * at: `indexnow:urlmap:<collection>:<id>` → absolute URL. We keep this
 * because `content:afterDelete` carries only `{ id, collection }` — no
 * slug — so the URL of a permanently-deleted item can't be rebuilt from
 * the delete event alone. Written whenever published content is saved,
 * read (and cleared) on permanent delete.
 */
const URLMAP_PREFIX = "indexnow:urlmap:";

/**
 * Records the epoch-ms of the last IndexNow submission per URL:
 * `indexnow:lastping:<url>` → number. Used to debounce rapid autosaves of
 * the same page so each editing burst pings at most once per window.
 */
const LASTPING_PREFIX = "indexnow:lastping:";

/**
 * Minimum gap between IndexNow submissions for the same URL. Editors
 * autosave frequently; without this guard every keystroke-save of a live
 * page would re-ping. A genuine edit in a later session (past the window)
 * still pings. Tunable trade-off: longer = fewer pings but can swallow a
 * real edit made shortly after publishing.
 */
const PING_DEBOUNCE_MS = 60_000;

function urlMapKey(collection: string, id: string): string {
  return `${URLMAP_PREFIX}${collection}:${id}`;
}

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
 * Submit a single URL to IndexNow for the current site. Resolves the host
 * from `ctx.site.url`, mints/reuses the key, and logs each engine result.
 * Returns silently when the site URL is missing or unparseable.
 */
async function submitUrlToIndexNow(ctx: PluginContext, url: string): Promise<void> {
  const siteUrl = ctx.site.url;
  if (!siteUrl) return;

  let host: string;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    return;
  }

  const key = await getOrCreateIndexNowKey(ctx);

  const results = await submitToIndexNow({ host, key, urls: [url] });

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
}

/** Extract a string `id` from a content record, or null. */
function contentId(content: Record<string, unknown>): string | null {
  return typeof content.id === "string" && content.id ? content.id : null;
}

/**
 * Handler for `content:afterUnpublish`. Submits the now-dead URL to
 * IndexNow so participating engines recrawl and pick up the 404/410.
 * Fire-and-forget: never throws, logs errors on ctx.log.
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

    await submitUrlToIndexNow(ctx, url);
  } catch (error) {
    ctx.log.warn("IndexNow: transition handler error", { error });
  }
}

/**
 * Handler for `content:afterPublish` and `content:afterSave`. Pings
 * IndexNow whenever *published* content is saved — this covers the
 * publish transition (via `afterPublish`) and, crucially, edits to an
 * already-published page (via `afterSave`), which `afterPublish` alone
 * never sees. Non-published saves (drafts, autosaves of unpublished
 * content) are ignored.
 *
 * Wiring both hooks here is deliberate: `afterPublish` guarantees the
 * publish ping even if `afterSave` semantics differ, and the per-URL
 * debounce (see `PING_DEBOUNCE_MS`) collapses the duplicate the two hooks
 * fire at the publish moment into a single submission.
 *
 * Also records the `id → url` mapping so a later permanent delete can
 * resolve the URL. Fire-and-forget: never throws.
 */
export async function handleIndexNowPublished(
  event: { content: Record<string, unknown>; collection: string },
  ctx: PluginContext,
): Promise<void> {
  try {
    if (!(await isIndexNowEnabled(ctx))) return;

    const status =
      typeof event.content.status === "string" ? event.content.status : null;
    if (status !== "published") return;

    const siteUrl = ctx.site.url;
    if (!siteUrl) return;

    const url = await urlForContent(event.content, event.collection, siteUrl);
    if (!url) return;

    // Remember where this id lives so afterDelete can ping the dead URL.
    const id = contentId(event.content);
    if (id) await ctx.kv.set(urlMapKey(event.collection, id), url);

    // Debounce rapid autosaves of the same URL.
    const lastKey = `${LASTPING_PREFIX}${url}`;
    const now = Date.now();
    const last = await ctx.kv.get<number>(lastKey);
    if (typeof last === "number" && now - last < PING_DEBOUNCE_MS) return;
    await ctx.kv.set(lastKey, now);

    await submitUrlToIndexNow(ctx, url);
  } catch (error) {
    ctx.log.warn("IndexNow: published handler error", { error });
  }
}

/**
 * Handler for `content:afterDelete`. On a *permanent* delete of content
 * that was previously published, submits its last-known URL to IndexNow
 * so engines recrawl and see the 404/410, then clears the cached mapping.
 * Trashing (`permanent === false`) is an unpublish and is handled by
 * `handleIndexNowTransition`; we skip it here. No-op when the id has no
 * cached URL (never published, or already cleaned up).
 */
export async function handleIndexNowDelete(
  event: { id: string; collection: string; permanent: boolean },
  ctx: PluginContext,
): Promise<void> {
  try {
    if (!event.permanent) return;
    if (!(await isIndexNowEnabled(ctx))) return;

    const mapKey = urlMapKey(event.collection, event.id);
    const url = await ctx.kv.get<string>(mapKey);
    if (typeof url !== "string" || !url) return;

    await submitUrlToIndexNow(ctx, url);

    await ctx.kv.delete(mapKey);
    await ctx.kv.delete(`${LASTPING_PREFIX}${url}`);
  } catch (error) {
    ctx.log.warn("IndexNow: delete handler error", { error });
  }
}

/** Returns the plain-text body to serve at `/<key>.txt`. */
export async function getKeyFileBody(ctx: PluginContext): Promise<string> {
  const key = await getOrCreateIndexNowKey(ctx);
  return getIndexNowKeyFileContent(key);
}
