import { apiFetch as baseFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";
import type { PluginAdminExports } from "emdash";

const API = "/_emdash/api/plugins/seo";

async function apiFetch(route: string, body?: unknown): Promise<Response> {
  return baseFetch(`${API}/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

interface FieldDef {
  key: string;
  type: "string" | "select";
  label: string;
  description?: string;
  multiline?: boolean;
  options?: Array<{ value: string; label: string }>;
  default?: string;
  section?: string;
}

const FIELDS: FieldDef[] = [
  { key: "siteRepresents", type: "select", label: "Site represents", description: "Does this site represent a person or an organization?", options: [{ value: "person", label: "Person" }, { value: "organization", label: "Organization" }], default: "person", section: "general" },
  { key: "separator", type: "select", label: "Title separator", description: "Character between page title and site name", options: [{ value: " — ", label: "— (em dash)" }, { value: " | ", label: "| (pipe)" }, { value: " - ", label: "- (hyphen)" }, { value: " · ", label: "· (dot)" }], default: " — ", section: "general" },
  { key: "defaultDescription", type: "string", label: "Default meta description", description: "Fallback for pages without their own", multiline: true, section: "general" },
  { key: "personName", type: "string", label: "Person name", description: "Full name of the person this site represents", section: "person" },
  { key: "personDescription", type: "string", label: "Person bio", description: "Short biography (max 250 characters for schema.org)", multiline: true, section: "person" },
  { key: "personImageUrl", type: "string", label: "Person image URL", description: "URL to the person's photo", section: "person" },
  { key: "personJobTitle", type: "string", label: "Person job title", description: "Job title for schema.org Person", section: "person" },
  { key: "personUrl", type: "string", label: "Person URL", description: "About page or personal website", section: "person" },
  { key: "orgName", type: "string", label: "Organization name", section: "org" },
  { key: "orgLogoUrl", type: "string", label: "Organization logo URL", section: "org" },
  { key: "socialTwitter", type: "string", label: "X (Twitter) URL", section: "social" },
  { key: "socialFacebook", type: "string", label: "Facebook URL", section: "social" },
  { key: "socialLinkedIn", type: "string", label: "LinkedIn URL", section: "social" },
  { key: "socialInstagram", type: "string", label: "Instagram URL", section: "social" },
  { key: "socialYouTube", type: "string", label: "YouTube URL", section: "social" },
  { key: "socialGitHub", type: "string", label: "GitHub URL", section: "social" },
  { key: "socialBluesky", type: "string", label: "Bluesky URL", section: "social" },
  { key: "socialMastodon", type: "string", label: "Mastodon URL", section: "social" },
  { key: "socialWikipedia", type: "string", label: "Wikipedia URL", section: "social" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: 6,
  border: "1px solid #d1d5db", fontSize: "0.875rem",
  fontFamily: "inherit",
};

function Field({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: "0.875rem" }}>
        {field.label}
      </label>
      {field.description && (
        <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: 4 }}>{field.description}</div>
      )}
      {field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          rows={3} style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch("settings").then(async (res) => {
      const data = await parseApiResponse<{ settings: Record<string, string> }>(res);
      setSettings(data.settings || {});
      setLoading(false);
    }).catch((err) => {
      setError(String(err));
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch("settings/save", { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
    setSaving(false);
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div style={{ padding: "2rem" }}>Loading settings...</div>;
  if (error) return <div style={{ padding: "2rem", color: "#dc2626" }}>Error: {error}</div>;

  const siteRepresents = settings.siteRepresents || "person";

  const sections = [
    { id: "general", label: "General" },
    ...(siteRepresents === "person" ? [{ id: "person", label: "Person" }] : [{ id: "org", label: "Organization" }]),
    { id: "social", label: "Social Profiles" },
  ];

  return (
    <div style={{ maxWidth: 640, padding: "1.5rem 0" }}>
      {sections.map((section) => (
        <div key={section.id} style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>
            {section.label}
          </h3>
          {FIELDS.filter((f) => f.section === section.id).map((field) => (
            <Field
              key={field.key}
              field={field}
              value={settings[field.key] || field.default || ""}
              onChange={(v) => update(field.key, v)}
            />
          ))}
        </div>
      ))}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "0.5rem 1.5rem", borderRadius: 6, background: "#4a1525",
          color: "white", border: "none", cursor: saving ? "wait" : "pointer", fontWeight: 500,
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
      {saved && <span style={{ marginLeft: 12, color: "#16a34a", fontSize: "0.875rem" }}>Settings saved!</span>}
    </div>
  );
}

const adminExports: PluginAdminExports = {
  pages: {
    "/": SettingsPage,
  },
};

export const pages = {
  "/settings": SettingsPage,
};
