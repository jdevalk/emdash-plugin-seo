import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "emdash";

import { listSchemaEntries } from "../src/schema/endpoints.js";

const mockState: {
  i18nEnabled: boolean;
  collections: Array<{ slug: string; label: string; urlPattern?: string }>;
} = {
  i18nEnabled: false,
  collections: [],
};

vi.mock("emdash", () => ({
  isI18nEnabled: () => mockState.i18nEnabled,
  getI18nConfig: () => null,
  SchemaRegistry: class {
    async listCollections() {
      return mockState.collections;
    }
  },
}));

vi.mock("emdash/runtime", () => ({
  getDb: async () => ({}),
}));

type Item = {
  id: string;
  type: string;
  slug: string | null;
  status: string;
  locale: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function makeCtx(items: Record<string, Item[]>): PluginContext {
  const store = new Map<string, unknown>();
  const kv = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
    list: async (prefix?: string) =>
      Array.from(store.entries())
        .filter(([k]) => !prefix || k.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
  };
  const content = {
    get: async () => null,
    list: async (collection: string, opts?: { where?: { status?: string; locale?: string } }) => {
      let all = items[collection] ?? [];
      if (opts?.where?.status) all = all.filter((i) => i.status === opts.where!.status);
      if (opts?.where?.locale) all = all.filter((i) => i.locale === opts.where!.locale);
      return { items: all, cursor: undefined, hasMore: false };
    },
  };
  return {
    plugin: { id: "seo", version: "0" },
    kv,
    content,
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    site: { name: "Example", url: "https://example.com", locale: "en" },
    url: (p: string) => `https://example.com${p}`,
  } as unknown as PluginContext;
}

beforeEach(() => {
  mockState.i18nEnabled = false;
  mockState.collections = [];
});

describe("listSchemaEntries", () => {
  it("returns an empty array when no collections exist", async () => {
    expect(await listSchemaEntries(makeCtx({}))).toEqual([]);
  });

  it("projects published items to {url, collection, updatedAt} triples", async () => {
    mockState.collections = [
      { slug: "blog", label: "Blog", urlPattern: "/blog/{slug}" },
      { slug: "pages", label: "Pages", urlPattern: "/{slug}" },
    ];
    const ctx = makeCtx({
      blog: [
        {
          id: "1",
          type: "content",
          slug: "hello",
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-02-01T00:00:00Z",
        },
        {
          id: "2",
          type: "content",
          slug: "wip",
          status: "draft",
          locale: "en",
          data: {},
          createdAt: "2026-01-02T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
      pages: [
        {
          id: "3",
          type: "content",
          slug: "about",
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-01-03T00:00:00Z",
          updatedAt: "2026-01-03T00:00:00Z",
        },
      ],
    });

    const result = await listSchemaEntries(ctx);

    expect(result).toEqual([
      {
        url: "https://example.com/blog/hello/",
        collection: "blog",
        updatedAt: "2026-02-01T00:00:00Z",
      },
      {
        url: "https://example.com/about/",
        collection: "pages",
        updatedAt: "2026-01-03T00:00:00Z",
      },
    ]);
  });

  it("skips collections without a urlPattern", async () => {
    mockState.collections = [
      { slug: "internal", label: "Internal" },
      { slug: "blog", label: "Blog", urlPattern: "/blog/{slug}" },
    ];
    const ctx = makeCtx({
      internal: [
        {
          id: "1",
          type: "content",
          slug: "secret",
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      blog: [
        {
          id: "2",
          type: "content",
          slug: "post",
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-01-02T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
    });

    const result = await listSchemaEntries(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]!.collection).toBe("blog");
  });

  it("skips items missing a slug", async () => {
    mockState.collections = [{ slug: "blog", label: "Blog", urlPattern: "/blog/{slug}" }];
    const ctx = makeCtx({
      blog: [
        {
          id: "1",
          type: "content",
          slug: null,
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(await listSchemaEntries(ctx)).toEqual([]);
  });

  it("falls back to createdAt when updatedAt is missing", async () => {
    mockState.collections = [{ slug: "blog", label: "Blog", urlPattern: "/blog/{slug}" }];
    const ctx = makeCtx({
      blog: [
        {
          id: "1",
          type: "content",
          slug: "hello",
          status: "published",
          locale: "en",
          data: {},
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "" as unknown as string,
        },
      ],
    });
    const result = await listSchemaEntries(ctx);
    expect(result[0]!.updatedAt).toBe("2026-03-01T00:00:00Z");
  });
});
