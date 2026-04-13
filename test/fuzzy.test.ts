import { describe, expect, it } from "vitest";

import { levenshtein, rankCandidates, scoreSlugMatch } from "../src/fuzzy.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("returns length for empty-string comparison", () => {
    expect(levenshtein("", "hello")).toBe(5);
    expect(levenshtein("hello", "")).toBe(5);
  });

  it("counts single-character edits", () => {
    expect(levenshtein("kitten", "sitten")).toBe(1);
    expect(levenshtein("hello", "helo")).toBe(1);
  });

  it("handles the canonical kitten→sitting example", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("scoreSlugMatch", () => {
  it("scores identical normalized paths as 1", () => {
    expect(scoreSlugMatch("/blog/hello", "/blog/hello")).toBe(1);
  });

  it("treats trailing slash and case as equivalent", () => {
    expect(scoreSlugMatch("/Blog/Hello/", "/blog/hello")).toBe(1);
  });

  it("gives high scores to single-character typos", () => {
    const score = scoreSlugMatch("/blog/hello", "/blgo/hello");
    expect(score).toBeGreaterThan(0.75);
  });

  it("rewards shared final slug across moved prefixes", () => {
    // Classic 'post moved to new section' case
    const score = scoreSlugMatch("/blog/old/hello-world", "/posts/hello-world");
    expect(score).toBeGreaterThan(0.6);
  });

  it("scores unrelated paths low", () => {
    const score = scoreSlugMatch("/blog/hello", "/about/team");
    expect(score).toBeLessThan(0.3);
  });

  it("handles punctuation drift (underscore vs hyphen)", () => {
    const score = scoreSlugMatch("/blog/hello_world", "/blog/hello-world");
    expect(score).toBeGreaterThan(0.85);
  });
});

describe("rankCandidates", () => {
  it("returns matches sorted by score descending", () => {
    const target = "/blog/hello";
    const candidates = [
      "/about/team",
      "/blog/hello-world",
      "/posts/hello",
      "/blog/hello",
    ];
    const result = rankCandidates(target, candidates, { limit: 3, minScore: 0 });
    expect(result[0]!.candidate).toBe("/blog/hello");
    expect(result[0]!.score).toBe(1);
    // Scores must be monotonically non-increasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
    }
  });

  it("filters candidates below minScore", () => {
    const result = rankCandidates("/blog/hello", ["/about/team", "/contact"], {
      minScore: 0.5,
    });
    expect(result).toEqual([]);
  });

  it("respects the limit cap", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => `/blog/post-${i}`);
    const result = rankCandidates("/blog/post-0", candidates, { limit: 3, minScore: 0 });
    expect(result).toHaveLength(3);
  });
});
