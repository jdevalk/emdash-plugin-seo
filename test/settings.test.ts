import { describe, expect, it } from "vitest";

import { parseSettings } from "../src/settings.js";

describe("parseSettings", () => {
  it("defaults nlwebEndpoint to an empty string when absent", () => {
    const s = parseSettings(new Map());
    expect(s.nlwebEndpoint).toBe("");
  });

  it("passes nlwebEndpoint through when set", () => {
    const s = parseSettings(new Map([["nlwebEndpoint", "https://example.com/nlweb"]]));
    expect(s.nlwebEndpoint).toBe("https://example.com/nlweb");
  });
});
