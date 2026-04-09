import { describe, expect, it } from "vitest";
import type { I18nConfig } from "emdash";

import { buildPageUrl } from "../src/urls.js";

const SITE = "https://example.com";

const CFG_NO_PREFIX_DEFAULT: I18nConfig = {
  defaultLocale: "en",
  locales: ["en", "fr", "nl"],
  prefixDefaultLocale: false,
};

const CFG_PREFIX_DEFAULT: I18nConfig = {
  defaultLocale: "en",
  locales: ["en", "fr", "nl"],
  prefixDefaultLocale: true,
};

describe("buildPageUrl", () => {
  describe("default locale, prefixDefaultLocale=false", () => {
    it("produces an unprefixed URL for the default locale", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toBe("https://example.com/hello/");
    });

    it("produces a prefixed URL for a non-default locale", () => {
      expect(
        buildPageUrl({
          locale: "fr",
          slug: "bonjour",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toBe("https://example.com/fr/bonjour/");
    });

    it("handles multi-segment urlPatterns", () => {
      expect(
        buildPageUrl({
          locale: "fr",
          slug: "bonjour",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/blog/{slug}",
        }),
      ).toBe("https://example.com/fr/blog/bonjour/");
    });
  });

  describe("prefixDefaultLocale=true", () => {
    it("prefixes the default locale when prefixDefaultLocale is true", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toBe("https://example.com/en/hello/");
    });
  });

  describe("normalization", () => {
    it("lowercases the path", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "Hello-World",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/Blog/{slug}",
        }),
      ).toBe("https://example.com/blog/hello-world/");
    });

    it("collapses duplicate slashes in the pattern", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/blog//{slug}",
        }),
      ).toBe("https://example.com/blog/hello/");
    });

    it("enforces a trailing slash", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toMatch(/\/$/);
    });

    it("tolerates a trailing slash on siteUrl", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: "https://example.com/",
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toBe("https://example.com/hello/");
    });
  });

  describe("rejection", () => {
    it("returns null when the pattern lacks {slug}", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/blog",
        }),
      ).toBeNull();
    });

    it("returns null when the pattern has unsubstituted placeholders", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: SITE,
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{category}/{slug}",
        }),
      ).toBeNull();
    });

    it("returns null when the siteUrl is not a valid absolute URL", () => {
      expect(
        buildPageUrl({
          locale: "en",
          slug: "hello",
          siteUrl: "not a url",
          cfg: CFG_NO_PREFIX_DEFAULT,
          urlPattern: "/{slug}",
        }),
      ).toBeNull();
    });
  });

  describe("BCP 47 region tags as locale paths", () => {
    const CFG_REGIONS: I18nConfig = {
      defaultLocale: "en",
      locales: ["en", "fr-ca", "fr-fr"],
      prefixDefaultLocale: false,
    };

    it("uses the region-tagged path as the URL prefix", () => {
      expect(
        buildPageUrl({
          locale: "fr-ca",
          slug: "bonjour",
          siteUrl: SITE,
          cfg: CFG_REGIONS,
          urlPattern: "/{slug}",
        }),
      ).toBe("https://example.com/fr-ca/bonjour/");
    });
  });
});
