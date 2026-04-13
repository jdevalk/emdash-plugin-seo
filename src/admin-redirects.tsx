import { apiFetch as baseFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

import { rankCandidates, type RankedMatch } from "./fuzzy.js";

const PLUGIN_API = "/_emdash/api/plugins/seo";
const CORE_API = "/_emdash/api";

interface NotFoundSummary {
  path: string;
  count: number;
  lastSeen: string;
  topReferrer: string | null;
}

interface SchemaMapEntry {
  url: string;
  collection: string;
  updatedAt: string;
}

interface Suggestion {
  entry: NotFoundSummary;
  matches: RankedMatch[];
  /** The currently-chosen destination — top match by default, editable. */
  chosen: string;
  /** True once a redirect has been successfully created for this entry. */
  created: boolean;
  /** Transient error from the last create attempt. */
  error: string | null;
  /** In-flight create request. */
  saving: boolean;
}

async function fetchNotFoundSummary(): Promise<NotFoundSummary[]> {
  const res = await baseFetch(`${CORE_API}/redirects/404s/summary?limit=100`, {
    method: "GET",
  });
  const data = await parseApiResponse<{ items: NotFoundSummary[] }>(res);
  return data.items ?? [];
}

async function fetchSchemaMap(): Promise<SchemaMapEntry[]> {
  const res = await baseFetch(`${PLUGIN_API}/schema/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await parseApiResponse<{ items: SchemaMapEntry[] }>(res);
  return data.items ?? [];
}

async function createRedirect(source: string, destination: string): Promise<void> {
  const res = await baseFetch(`${CORE_API}/redirects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source,
      destination,
      type: 301,
      enabled: true,
      groupName: "seo-fuzzy-suggester",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redirect create failed (${res.status}): ${text}`);
  }
}

/** Extract the path portion from an absolute URL. */
function urlToPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const rowStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
  background: "#fff",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.8125rem",
  background: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.375rem 0.5rem",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: "0.8125rem",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.375rem 0.875rem",
  borderRadius: 6,
  background: "#4a1525",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: "0.8125rem",
  fontWeight: 500,
};

export function FuzzyRedirectsPage() {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [minScore, setMinScore] = React.useState(0.5);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [log, map] = await Promise.all([fetchNotFoundSummary(), fetchSchemaMap()]);
      const candidatePaths = map.map((m) => urlToPath(m.url));
      const next: Suggestion[] = log.map((entry) => {
        const matches = rankCandidates(entry.path, candidatePaths, { limit: 3, minScore });
        return {
          entry,
          matches,
          chosen: matches[0]?.candidate ?? "",
          created: false,
          error: null,
          saving: false,
        };
      });
      setSuggestions(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [minScore]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (index: number, patch: Partial<Suggestion>) => {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleCreate = async (index: number) => {
    const row = suggestions[index];
    if (!row || !row.chosen) return;
    updateRow(index, { saving: true, error: null });
    try {
      await createRedirect(row.entry.path, row.chosen);
      updateRow(index, { saving: false, created: true });
    } catch (err) {
      updateRow(index, {
        saving: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const visible = suggestions.filter((s) => !s.created);

  return (
    <div style={{ maxWidth: 820, padding: "1.5rem 0" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Fuzzy Redirects
      </h1>
      <p style={{ fontSize: "0.875rem", color: "#4b5563", marginBottom: "1.5rem" }}>
        Reviews the 404 log, pairs each missing path with the closest matching
        published URLs, and lets you one-click create a 301 redirect. Matches are
        scored by path similarity — a slider tunes how aggressive the
        suggestions are.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.8125rem", color: "#4b5563" }}>
          Minimum match score: <strong>{minScore.toFixed(2)}</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minScore}
            onChange={(e) => setMinScore(parseFloat(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
          />
        </label>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: 6,
            background: "#f3f4f6",
            color: "#374151",
            border: "1px solid #d1d5db",
            cursor: loading ? "wait" : "pointer",
            fontSize: "0.8125rem",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loadError && (
        <div style={{ padding: "0.75rem", background: "#fef2f2", color: "#991b1b", borderRadius: 6, marginBottom: "1rem", fontSize: "0.875rem" }}>
          Failed to load: {loadError}
        </div>
      )}

      {!loading && !loadError && suggestions.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280", fontSize: "0.875rem" }}>
          No 404s logged. Hit a dead link on the live site to populate the log.
        </div>
      )}

      {!loading && !loadError && suggestions.length > 0 && visible.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#16a34a", fontSize: "0.875rem" }}>
          All suggestions handled — nothing left to redirect.
        </div>
      )}

      {visible.map((row) => {
        const index = suggestions.indexOf(row);
        return (
          <div key={row.entry.path} style={rowStyle}>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={codeStyle}>{row.entry.path}</span>
              <span style={{ marginLeft: 12, fontSize: "0.75rem", color: "#6b7280" }}>
                {row.entry.count} hit{row.entry.count === 1 ? "" : "s"}
                {row.entry.topReferrer ? ` · from ${row.entry.topReferrer}` : ""}
              </span>
            </div>

            {row.matches.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: "#9ca3af", fontStyle: "italic" }}>
                No matches above the score threshold. Enter a destination manually if you know one.
              </div>
            ) : (
              <div style={{ marginBottom: "0.5rem" }}>
                {row.matches.map((m) => (
                  <label
                    key={m.candidate}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: "0.8125rem" }}
                  >
                    <input
                      type="radio"
                      name={`dest-${index}`}
                      checked={row.chosen === m.candidate}
                      onChange={() => updateRow(index, { chosen: m.candidate })}
                    />
                    <span style={codeStyle}>{m.candidate}</span>
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                      score {m.score.toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "0.5rem" }}>
              <input
                type="text"
                value={row.chosen}
                onChange={(e) => updateRow(index, { chosen: e.target.value })}
                placeholder="/destination/path"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => void handleCreate(index)}
                disabled={row.saving || !row.chosen}
                style={{ ...primaryButtonStyle, cursor: row.saving ? "wait" : row.chosen ? "pointer" : "not-allowed", opacity: row.chosen ? 1 : 0.5 }}
              >
                {row.saving ? "Creating…" : "Create redirect"}
              </button>
            </div>

            {row.error && (
              <div style={{ marginTop: 6, fontSize: "0.75rem", color: "#dc2626" }}>
                {row.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
