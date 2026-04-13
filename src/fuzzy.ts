/**
 * Fuzzy URL-path matching for redirect suggestions.
 *
 * Scores how similar two URL paths are on a [0, 1] scale, where 1 is an
 * exact (normalized) match and 0 is no shared structure. The score
 * combines three signals:
 *
 *   1. Levenshtein distance on the full normalized path (catches typos
 *      like `/blgo/hello` → `/blog/hello`).
 *   2. Token overlap — tokenize by `/`, `-`, `_` and compare shared
 *      tokens (catches reordering or punctuation drift like
 *      `hello-world` ↔ `world-hello`, `hello_world` ↔ `hello-world`).
 *   3. Last-segment (slug) exact match — a huge bonus, since a matching
 *      terminal slug is almost always the right target when the
 *      prefix has changed (e.g. `/blog/old/hello` → `/posts/hello`).
 *
 * Used by the admin "Fuzzy Redirects" tool to suggest redirect targets
 * for logged 404s, and intended to be reused by the eventual
 * `notfound` hook once upstream lands.
 */

const SPLIT_RE = /[/\-_]+/g;
const SEG_SPLIT_RE = /[-_]+/g;
const MULTI_SLASH_RE = /\/+/g;

function normalize(path: string): string {
  let p = path.toLowerCase().trim();
  p = p.replace(MULTI_SLASH_RE, "/");
  if (p.endsWith("/") && p.length > 1) p = p.slice(0, -1);
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function tokenize(path: string): string[] {
  return path.split(SPLIT_RE).filter(Boolean);
}

/**
 * Normalized key for the final URL segment. Tokens are lowercased,
 * split on `-`/`_`, sorted, and joined — so `hello_world`,
 * `hello-world`, and `world-hello` all produce the same key.
 *
 * This keeps the "matching final slug" bonus robust to punctuation and
 * ordering drift, which are common when slugs get rewritten during a
 * site migration.
 */
function lastSegmentKey(path: string): string {
  const segs = path.split("/").filter(Boolean);
  const last = segs.at(-1) ?? "";
  return last
    .split(SEG_SPLIT_RE)
    .filter(Boolean)
    .sort()
    .join("|");
}

/**
 * Classic dynamic-programming Levenshtein distance. Kept local — this
 * is a ~30-line function and pulling in a dependency for it isn't worth
 * the supply-chain surface.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two-row rolling buffer — O(min(|a|,|b|)) memory.
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1, // insertion
        prev[j]! + 1, // deletion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length]!;
}

/**
 * Score the similarity of two URL paths on [0, 1]. Higher is better.
 *
 * The scoring is tuned so that:
 *   - A single-character typo in a short path still scores well above
 *     unrelated paths (distance 1 / length 10 → 0.9 Levenshtein alone,
 *     before token bonuses).
 *   - Two paths sharing the final slug but with different prefixes
 *     score in the 0.7–0.9 range (the "post moved to a new section"
 *     case).
 *   - Paths with no shared tokens AND no character overlap score near
 *     zero, so the UI can threshold them out.
 */
export function scoreSlugMatch(target: string, candidate: string): number {
  const t = normalize(target);
  const c = normalize(candidate);
  if (t === c) return 1;

  // Component 1: Levenshtein similarity on the full path.
  const distance = levenshtein(t, c);
  const maxLen = Math.max(t.length, c.length);
  const levSim = maxLen === 0 ? 0 : 1 - distance / maxLen;

  // Component 2: token overlap (Jaccard index on tokenized paths).
  const tTokens = new Set(tokenize(t));
  const cTokens = new Set(tokenize(c));
  const intersection = new Set([...tTokens].filter((x) => cTokens.has(x)));
  const union = new Set([...tTokens, ...cTokens]);
  const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

  // Component 3: last-segment match bonus, tokenized + sorted so
  // punctuation and word order don't defeat it.
  const tKey = lastSegmentKey(t);
  const slugMatch = tKey && tKey === lastSegmentKey(c) ? 1 : 0;

  // Weighted composite. Levenshtein carries the long tail (small-edit
  // typos); slug match is the strongest single signal when the slug
  // itself survived a URL rewrite; Jaccard breaks ties among
  // candidates with similar lev distance.
  return levSim * 0.5 + jaccard * 0.2 + slugMatch * 0.3;
}

export interface RankedMatch {
  candidate: string;
  score: number;
}

/**
 * Rank candidate paths against a target by fuzzy similarity.
 *
 * Returns up to `limit` matches with score ≥ `minScore`, sorted by
 * score descending. Callers that want "no suggestion" behavior for
 * weak matches should use a `minScore` around 0.5 — below that the
 * suggestion quality drops sharply.
 */
export function rankCandidates(
  target: string,
  candidates: string[],
  opts: { limit?: number; minScore?: number } = {},
): RankedMatch[] {
  const limit = opts.limit ?? 3;
  const minScore = opts.minScore ?? 0.5;

  const scored: RankedMatch[] = candidates
    .map((candidate) => ({ candidate, score: scoreSlugMatch(target, candidate) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
