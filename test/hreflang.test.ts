import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  I18nConfig,
  PageMetadataContribution,
  PluginContext,
  PublicPageContext,
  TranslationsResult,
} from "emdash";

import { generateHreflang } from "../src/hreflang.js";

// Mock the `emdash` module. Each test configures `mockState` to control
// what the mocked functions return. Using a mutable state object (vs
// per-test vi.doMock) keeps the test code readable.
interface MockState {
  i18nEnabled: boolean;
  i18nConfig: I18nConfig | null;
  translationsResult: TranslationsResult | Error;
  collectionInfo: { urlPattern?: string } | null | Error;
}

const mockState: MockState = {
  i18nEnabled: true,
  i18nConfig: {
    defaultLocale: "en",
    locales: ["en", "fr", "nl"],
    prefixDefaultLocale: false,
  },
  translationsResult: {
    translationGroup: "group-1",
    translations: [],
  },
  collectionInfo: { urlPattern: "/{slug}" },
};

vi.mock("emdash", () => ({
  isI18nEnabled: () => mockState.i18nEnabled,
  getI18nConfig: () => mockState.i18nConfig,
  getTranslations: async () => {
    if (mockState.translationsResult instanceof Error) {
      throw mockState.translationsResult;
    }
    return mockState.translationsResult;
  },
  getCollectionInfo: async () => {
    if (mockState.collectionInfo instanceof Error) {
      throw mockState.collectionInfo;
    }
    return mockState.collectionInfo;
  },
}));

const SITE = "https://example.com";

function makePage(overrides: Partial<PublicPageContext> = {}): PublicPageContext {
  return {
    url: "https://example.com/hello/",
    path: "/hello/",
    locale: "en",
    kind: "content",
    pageType: "post",
    title: "Hello",
    description: null,
    canonical: null,
    image: null,
    content: {
      collection: "posts",
      id: "post-1",
      slug: "hello",
    },
    ...overrides,
  };
}

function makeCtx(): PluginContext {
  const warn = vi.fn();
  // The plugin only touches ctx.log.warn and nothing else. A minimal
  // stub is sufficient — full PluginContext is huge.
  return {
    log: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
  } as unknown as PluginContext;
}

function resetMockState(): void {
  mockState.i18nEnabled = true;
  mockState.i18nConfig = {
    defaultLocale: "en",
    locales: ["en", "fr", "nl"],
    prefixDefaultLocale: false,
  };
  mockState.translationsResult = {
    translationGroup: "group-1",
    translations: [],
  };
  mockState.collectionInfo = { urlPattern: "/{slug}" };
}

beforeEach(resetMockState);

describe("generateHreflang", () => {
  describe("gating", () => {
    it("returns [] when i18n is disabled", async () => {
      mockState.i18nEnabled = false;
      const page = makePage();
      const out = await generateHreflang(page, makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when page.kind is 'custom'", async () => {
      const page = makePage({ kind: "custom", content: undefined });
      const out = await generateHreflang(page, makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when page.content is missing", async () => {
      const page = makePage({ content: undefined });
      const out = await generateHreflang(page, makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when getI18nConfig returns null", async () => {
      mockState.i18nConfig = null;
      const page = makePage();
      const out = await generateHreflang(page, makeCtx(), SITE);
      expect(out).toEqual([]);
    });
  });

  describe("data failures", () => {
    it("returns [] and warns when getTranslations throws", async () => {
      mockState.translationsResult = new Error("boom");
      const ctx = makeCtx();
      const out = await generateHreflang(makePage(), ctx, SITE);
      expect(out).toEqual([]);
      expect(ctx.log.warn).toHaveBeenCalledWith(
        "hreflang: getTranslations failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("returns [] when getTranslations returns { error }", async () => {
      mockState.translationsResult = {
        translationGroup: "",
        translations: [],
        error: new Error("missing"),
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when only one sibling is returned", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when the current entry is not in the translation group", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "other-1", locale: "en", slug: "hello", status: "published" },
          { id: "other-2", locale: "fr", slug: "bonjour", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out).toEqual([]);
    });

    it("returns [] when getCollectionInfo throws", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
        ],
      };
      mockState.collectionInfo = new Error("db down");
      const ctx = makeCtx();
      const out = await generateHreflang(makePage(), ctx, SITE);
      expect(out).toEqual([]);
      expect(ctx.log.warn).toHaveBeenCalledWith(
        "hreflang: getCollectionInfo failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("returns [] when the collection has no urlPattern", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
        ],
      };
      mockState.collectionInfo = { urlPattern: undefined };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out).toEqual([]);
    });
  });

  describe("happy path", () => {
    it("emits 3 per-locale entries + x-default for a 3-locale post, prefixDefaultLocale=false", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
          { id: "post-3", locale: "nl", slug: "hallo", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);

      expect(out).toHaveLength(4);

      // Type guard: all contributions are link kinds
      for (const c of out) expect(c.kind).toBe("link");

      expect(out.map(linkHreflang)).toEqual(["en", "fr", "nl", "x-default"]);
      expect(out.map(linkHref)).toEqual([
        "https://example.com/hello/",
        "https://example.com/fr/bonjour/",
        "https://example.com/nl/hallo/",
        "https://example.com/hello/", // x-default → en (default)
      ]);

      // Each contribution has a unique key for page:metadata dedup
      expect(out.map(linkKey)).toEqual([
        "hreflang:en",
        "hreflang:fr",
        "hreflang:nl",
        "hreflang:x-default",
      ]);
    });

    it("prefixes default-locale URLs when prefixDefaultLocale=true", async () => {
      mockState.i18nConfig = {
        defaultLocale: "en",
        locales: ["en", "fr"],
        prefixDefaultLocale: true,
      };
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHref)).toEqual([
        "https://example.com/en/hello/",
        "https://example.com/fr/bonjour/",
        "https://example.com/en/hello/", // x-default → en (with prefix)
      ]);
    });

    it("excludes draft siblings", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "draft" },
          { id: "post-3", locale: "nl", slug: "hallo", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHreflang)).toEqual(["en", "nl", "x-default"]);
    });

    it("excludes siblings with null slugs", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: null, status: "published" },
          { id: "post-3", locale: "nl", slug: "hallo", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHreflang)).toEqual(["en", "nl", "x-default"]);
    });

    it("excludes siblings whose locale is not in the active i18n config", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
          // "de" is not in mockState.i18nConfig.locales
          { id: "post-3", locale: "de", slug: "hallo", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHreflang)).toEqual(["en", "fr", "x-default"]);
    });

    it("emits region-tagged hreflang attributes (fr-ca → fr-CA)", async () => {
      mockState.i18nConfig = {
        defaultLocale: "en",
        locales: ["en", "fr-ca", "fr-fr"],
        prefixDefaultLocale: false,
      };
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr-ca", slug: "bonjour", status: "published" },
          { id: "post-3", locale: "fr-fr", slug: "salut", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHreflang)).toEqual(["en", "fr-CA", "fr-FR", "x-default"]);
      expect(out.map(linkHref)).toEqual([
        "https://example.com/hello/",
        "https://example.com/fr-ca/bonjour/",
        "https://example.com/fr-fr/salut/",
        "https://example.com/hello/",
      ]);
    });

    it("handles multi-segment urlPatterns (/blog/{slug})", async () => {
      mockState.collectionInfo = { urlPattern: "/blog/{slug}" };
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-1", locale: "en", slug: "hello", status: "published" },
          { id: "post-2", locale: "fr", slug: "bonjour", status: "published" },
        ],
      };
      const out = await generateHreflang(makePage(), makeCtx(), SITE);
      expect(out.map(linkHref)).toEqual([
        "https://example.com/blog/hello/",
        "https://example.com/fr/blog/bonjour/",
        "https://example.com/blog/hello/",
      ]);
    });
  });

  describe("reciprocity invariant", () => {
    it("produces identical URL sets regardless of which sibling is the 'current' page", async () => {
      mockState.translationsResult = {
        translationGroup: "group-1",
        translations: [
          { id: "post-en", locale: "en", slug: "hello", status: "published" },
          { id: "post-fr", locale: "fr", slug: "bonjour", status: "published" },
          { id: "post-nl", locale: "nl", slug: "hallo", status: "published" },
        ],
      };

      const runAs = async (currentId: string, currentLocale: string) => {
        const page = makePage({
          locale: currentLocale,
          content: { collection: "posts", id: currentId, slug: "slug-ignored" },
        });
        return generateHreflang(page, makeCtx(), SITE);
      };

      const fromEn = await runAs("post-en", "en");
      const fromFr = await runAs("post-fr", "fr");
      const fromNl = await runAs("post-nl", "nl");

      // Same set of per-locale URLs (excluding x-default) from every angle
      const toSet = (out: PageMetadataContribution[]) =>
        out
          .filter((c) => linkHreflang(c) !== "x-default")
          .map((c) => `${linkHreflang(c)}=${linkHref(c)}`)
          .sort();

      expect(toSet(fromEn)).toEqual(toSet(fromFr));
      expect(toSet(fromFr)).toEqual(toSet(fromNl));

      // Every run agrees on the x-default target (points at the
      // default-locale sibling).
      const xDefault = (out: PageMetadataContribution[]) =>
        out.find((c) => linkHreflang(c) === "x-default")!;
      expect(linkHref(xDefault(fromEn))).toBe("https://example.com/hello/");
      expect(linkHref(xDefault(fromFr))).toBe("https://example.com/hello/");
      expect(linkHref(xDefault(fromNl))).toBe("https://example.com/hello/");
    });
  });
});

// ── Helpers for inspecting link contributions ──────────────────────
// PageMetadataContribution is a discriminated union. These narrow it
// so the tests don't need to repeat the `c.kind === "link"` check.

function linkHref(c: PageMetadataContribution): string {
  if (c.kind !== "link") throw new Error("expected link contribution");
  return c.href;
}

function linkHreflang(c: PageMetadataContribution): string {
  if (c.kind !== "link") throw new Error("expected link contribution");
  return c.hreflang ?? "";
}

function linkKey(c: PageMetadataContribution): string | undefined {
  if (c.kind !== "link") throw new Error("expected link contribution");
  return c.key;
}
