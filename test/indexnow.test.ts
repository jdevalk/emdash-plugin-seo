import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "emdash";

import {
  getOrCreateIndexNowKey,
  handleIndexNowDelete,
  handleIndexNowPublished,
  handleIndexNowTransition,
  isIndexNowEnabled,
} from "../src/indexnow.js";

const mockState: {
  i18nEnabled: boolean;
  i18nConfig: { defaultLocale: string; locales: string[]; prefixDefaultLocale: boolean } | null;
  collectionInfo: { urlPattern?: string } | null;
} = {
  i18nEnabled: false,
  i18nConfig: null,
  collectionInfo: { urlPattern: "/blog/{slug}" },
};

vi.mock("emdash", () => ({
  isI18nEnabled: () => mockState.i18nEnabled,
  getI18nConfig: () => mockState.i18nConfig,
  getCollectionInfo: async () => mockState.collectionInfo,
}));

function makeCtx(overrides: Partial<PluginContext> = {}): PluginContext {
  const store = new Map<string, unknown>();
  const kv = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
    list: async () => Array.from(store.entries()).map(([key, value]) => ({ key, value })),
  };
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    plugin: { id: "seo", version: "0" },
    kv,
    log,
    site: { name: "Site", url: "https://example.com", locale: "en" },
    url: (p: string) => `https://example.com${p}`,
    ...overrides,
  } as unknown as PluginContext;
}

beforeEach(() => {
  mockState.i18nEnabled = false;
  mockState.i18nConfig = null;
  mockState.collectionInfo = { urlPattern: "/blog/{slug}" };
});

describe("getOrCreateIndexNowKey", () => {
  it("generates and persists a key on first call", async () => {
    const ctx = makeCtx();
    const key = await getOrCreateIndexNowKey(ctx);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    expect(await ctx.kv.get("indexnow:key")).toBe(key);
  });

  it("reuses an existing valid key", async () => {
    const ctx = makeCtx();
    const existing = "abcdef0123456789abcdef0123456789";
    await ctx.kv.set("indexnow:key", existing);
    expect(await getOrCreateIndexNowKey(ctx)).toBe(existing);
  });

  it("replaces an invalid stored key", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("indexnow:key", "not-hex");
    const key = await getOrCreateIndexNowKey(ctx);
    expect(key).not.toBe("not-hex");
    expect(key).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("isIndexNowEnabled", () => {
  it("defaults to false", async () => {
    expect(await isIndexNowEnabled(makeCtx())).toBe(false);
  });

  it("reads true/false from KV as string", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    expect(await isIndexNowEnabled(ctx)).toBe(true);
    await ctx.kv.set("settings:indexnowEnabled", "false");
    expect(await isIndexNowEnabled(ctx)).toBe(false);
  });
});

describe("handleIndexNowTransition", () => {
  const fetchSpy = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response("", { status: 200 }),
  );

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("does nothing when disabled", async () => {
    const ctx = makeCtx();
    await handleIndexNowTransition(
      { content: { id: "1", slug: "hello" }, collection: "blog" },
      ctx,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits the URL when enabled and URL builds", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowTransition(
      { content: { id: "1", slug: "hello" }, collection: "blog" },
      ctx,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.host).toBe("example.com");
    expect(body.urlList).toEqual(["https://example.com/blog/hello/"]);
    expect(body.key).toMatch(/^[a-f0-9]{32}$/);
  });

  it("skips silently when collection has no urlPattern", async () => {
    mockState.collectionInfo = {};
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowTransition(
      { content: { id: "1", slug: "hello" }, collection: "blog" },
      ctx,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips when content has no slug", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowTransition(
      { content: { id: "1" }, collection: "blog" },
      ctx,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not throw when fetch fails", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await expect(
      handleIndexNowTransition(
        { content: { id: "1", slug: "hello" }, collection: "blog" },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect((ctx.log.warn as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
});

describe("handleIndexNowPublished", () => {
  const fetchSpy = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response("", { status: 200 }),
  );

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  const published = { content: { id: "1", slug: "hello", status: "published" }, collection: "blog" };

  it("does nothing when disabled", async () => {
    const ctx = makeCtx();
    await handleIndexNowPublished(published, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when status is not published", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowPublished(
      { content: { id: "1", slug: "hello", status: "draft" }, collection: "blog" },
      ctx,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits and caches the id→url mapping when published & enabled", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowPublished(published, ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await ctx.kv.get("indexnow:urlmap:blog:1")).toBe(
      "https://example.com/blog/hello/",
    );
  });

  it("debounces a second save of the same URL within the window", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowPublished(published, ctx);
    await handleIndexNowPublished(published, ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("pings again once the debounce window has elapsed", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    // Pretend the last ping was two minutes ago.
    await ctx.kv.set(
      "indexnow:lastping:https://example.com/blog/hello/",
      Date.now() - 120_000,
    );
    await handleIndexNowPublished(published, ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("handleIndexNowDelete", () => {
  const fetchSpy = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response("", { status: 200 }),
  );

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("does nothing for a trash (non-permanent) delete", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await ctx.kv.set("indexnow:urlmap:blog:1", "https://example.com/blog/hello/");
    await handleIndexNowDelete({ id: "1", collection: "blog", permanent: false }, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("indexnow:urlmap:blog:1", "https://example.com/blog/hello/");
    await handleIndexNowDelete({ id: "1", collection: "blog", permanent: true }, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-ops when the id has no cached URL", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await handleIndexNowDelete({ id: "99", collection: "blog", permanent: true }, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits the cached URL and clears the mapping on permanent delete", async () => {
    const ctx = makeCtx();
    await ctx.kv.set("settings:indexnowEnabled", "true");
    await ctx.kv.set("indexnow:urlmap:blog:1", "https://example.com/blog/hello/");
    await ctx.kv.set("indexnow:lastping:https://example.com/blog/hello/", Date.now());
    await handleIndexNowDelete({ id: "1", collection: "blog", permanent: true }, ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.urlList).toEqual(["https://example.com/blog/hello/"]);
    expect(await ctx.kv.get("indexnow:urlmap:blog:1")).toBeUndefined();
    expect(
      await ctx.kv.get("indexnow:lastping:https://example.com/blog/hello/"),
    ).toBeUndefined();
  });
});
