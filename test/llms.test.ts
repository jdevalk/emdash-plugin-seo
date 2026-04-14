import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "emdash";

import { buildLlmsTxt, generateLlmsTxt, isLlmsTxtEnabled } from "../src/llms.js";

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

describe("buildLlmsTxt", () => {
  it("renders a minimal body", () => {
    const out = buildLlmsTxt({ siteName: "Site", sections: {} });
    expect(out).toBe("# Site\n");
  });

  it("renders blockquote and sections", () => {
    const out = buildLlmsTxt({
      siteName: "Site",
      siteDescription: "A blog",
      sections: {
        Posts: [
          { title: "Hello", url: "https://example.com/hello/", description: "Intro post" },
          { title: "World", url: "https://example.com/world/" },
        ],
      },
    });
    expect(out).toBe(
      [
        "# Site",
        "",
        "> A blog",
        "",
        "## Posts",
        "",
        "- [Hello](https://example.com/hello/): Intro post",
        "- [World](https://example.com/world/)",
        "",
      ].join("\n"),
    );
  });

  it("skips empty sections", () => {
    const out = buildLlmsTxt({ siteName: "Site", sections: { Posts: [] } });
    expect(out).toBe("# Site\n");
  });
});

describe("isLlmsTxtEnabled", () => {
  it("defaults to true", async () => {
    expect(await isLlmsTxtEnabled(makeCtx({}))).toBe(true);
  });

  it("reads false from KV", async () => {
    const ctx = makeCtx({});
    await ctx.kv.set("settings:llmsTxtEnabled", "false");
    expect(await isLlmsTxtEnabled(ctx)).toBe(false);
  });

  it("reads true from KV", async () => {
    const ctx = makeCtx({});
    await ctx.kv.set("settings:llmsTxtEnabled", "true");
    expect(await isLlmsTxtEnabled(ctx)).toBe(true);
  });
});

describe("generateLlmsTxt", () => {
  it("returns null when explicitly disabled", async () => {
    const ctx = makeCtx({});
    await ctx.kv.set("settings:llmsTxtEnabled", "false");
    expect(await generateLlmsTxt(ctx)).toBeNull();
  });

  it("builds body from published content across collections", async () => {
    mockState.collections = [
      { slug: "blog", label: "Blog", urlPattern: "/blog/{slug}" },
      { slug: "pages", label: "Pages", urlPattern: "/{slug}" },
      { slug: "drafts", label: "No URL" }, // no urlPattern — skipped
    ];
    const ctx = makeCtx({
      blog: [
        {
          id: "1",
          type: "blog",
          slug: "hello",
          status: "published",
          locale: "en",
          data: { title: "Hello", description: "Intro" },
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "2",
          type: "blog",
          slug: "draft",
          status: "draft",
          locale: "en",
          data: { title: "Draft" },
          createdAt: "",
          updatedAt: "",
        },
      ],
      pages: [
        {
          id: "3",
          type: "pages",
          slug: "about",
          status: "published",
          locale: "en",
          data: { title: "About" },
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    await ctx.kv.set("settings:defaultDescription", "A site.");

    const body = await generateLlmsTxt(ctx);
    expect(body).toBe(
      [
        "# Example",
        "",
        "> A site.",
        "",
        "## Blog",
        "",
        "- [Hello](https://example.com/blog/hello/): Intro",
        "",
        "## Pages",
        "",
        "- [About](https://example.com/about/)",
        "",
      ].join("\n"),
    );
  });

  it("prefers llmsTxtDescription over defaultDescription", async () => {
    mockState.collections = [];
    const ctx = makeCtx({});
    await ctx.kv.set("settings:defaultDescription", "fallback");
    await ctx.kv.set("settings:llmsTxtDescription", "override");
    const body = await generateLlmsTxt(ctx);
    expect(body).toContain("> override");
    expect(body).not.toContain("fallback");
  });
});
