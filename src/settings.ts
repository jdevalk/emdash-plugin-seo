export interface NavigationItem {
  name: string;
  url: string;
}

export interface SeoSettings {
  siteRepresents: "person" | "organization";
  separator: string;
  defaultDescription: string;
  personName: string;
  personDescription: string;
  personImageUrl: string;
  personJobTitle: string;
  personUrl: string;
  orgName: string;
  orgLogoUrl: string;
  socials: string[];
  /** URL to editorial/publishing principles page. */
  publishingPrinciples: string;
  /** Copyright year (e.g. 2026). Applied to WebPage and Article nodes. */
  copyrightYear: number | null;
  /** License URL (e.g. Creative Commons). Applied to WebPage and Article nodes. */
  licenseUrl: string;
  /** Blog section URL (e.g. "https://example.com/blog/"). Enables Blog entity. */
  blogUrl: string;
  /** Blog name (defaults to "Blog" if blogUrl is set). */
  blogName: string;
  /** Main navigation items for SiteNavigationElement schema. */
  navigationItems: NavigationItem[];
  /**
   * Segment → display label map used by breadcrumb path derivation.
   * Keys are path segments (`"blog"`), not full paths.
   */
  breadcrumbLabels: Record<string, string>;
  /**
   * Per-`pageType` rule map that overrides path derivation.
   * Each rule is an ordered list of crumbs; `{title}` in a label is
   * replaced with `page.title`; an omitted `href` resolves to the
   * current page URL (canonical).
   */
  breadcrumbRules: Record<string, BreadcrumbRule>;
  /**
   * Absolute URL of an NLWeb endpoint. When set, the plugin contributes
   * a `<link rel="nlweb" href="...">` tag on every rendered page so
   * conversational agents can discover the site's chat surface.
   */
  nlwebEndpoint: string;
}

export interface BreadcrumbRuleCrumb {
  label: string;
  href?: string;
}

export type BreadcrumbRule = BreadcrumbRuleCrumb[];

const SOCIAL_KEYS = [
  "socialTwitter",
  "socialFacebook",
  "socialLinkedIn",
  "socialInstagram",
  "socialYouTube",
  "socialGitHub",
  "socialBluesky",
  "socialMastodon",
  "socialWikipedia",
] as const;

/**
 * Load settings from a key-value map (works with both plugin KV and direct DB queries).
 */
export function parseSettings(map: Map<string, string>): SeoSettings {
  const socials: string[] = [];
  for (const key of SOCIAL_KEYS) {
    const val = map.get(key);
    if (val) socials.push(val);
  }

  const copyrightYearRaw = map.get("copyrightYear");
  const copyrightYear = copyrightYearRaw ? parseInt(copyrightYearRaw, 10) || null : null;

  return {
    siteRepresents: (map.get("siteRepresents") as "person" | "organization") || "person",
    separator: map.get("separator") || " — ",
    defaultDescription: map.get("defaultDescription") || "",
    personName: map.get("personName") || "",
    personDescription: map.get("personDescription") || "",
    personImageUrl: map.get("personImageUrl") || "",
    personJobTitle: map.get("personJobTitle") || "",
    personUrl: map.get("personUrl") || "",
    orgName: map.get("orgName") || "",
    orgLogoUrl: map.get("orgLogoUrl") || "",
    socials,
    publishingPrinciples: map.get("publishingPrinciples") || "",
    copyrightYear,
    licenseUrl: map.get("licenseUrl") || "",
    blogUrl: map.get("blogUrl") || "",
    blogName: map.get("blogName") || "",
    navigationItems: parseJsonArray<NavigationItem>(map.get("navigationItems")),
    breadcrumbLabels: parseJsonRecord<string>(map.get("breadcrumbLabels")),
    breadcrumbRules: parseJsonRecord<BreadcrumbRule>(map.get("breadcrumbRules")),
    nlwebEndpoint: map.get("nlwebEndpoint") || "",
  };
}

/**
 * Parse a JSON-serialized record from KV. Returns an empty object on any
 * parse failure — bad settings should degrade silently to "no override"
 * rather than crash the page:metadata hook.
 */
function parseJsonRecord<V>(raw: string | undefined): Record<string, V> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, V>;
    }
  } catch {
    // fall through
  }
  return {};
}

function parseJsonArray<V>(raw: string | undefined): V[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as V[];
    }
  } catch {
    // fall through
  }
  return [];
}

/**
 * Load settings from plugin KV (used by the page:metadata hook for logged-in users).
 */
export async function loadSettings(kv: { list(prefix?: string): Promise<Array<{ key: string; value: unknown }>> }): Promise<SeoSettings> {
  const entries = await kv.list("settings:");
  const map = new Map<string, string>();
  for (const { key, value } of entries) {
    if (typeof value === "string") {
      map.set(key.replace("settings:", ""), value);
    }
  }
  return parseSettings(map);
}

export const settingsSchema = {
  siteRepresents: {
    type: "select" as const,
    label: "Site represents",
    description: "Does this site represent a person or an organization?",
    options: [
      { value: "person", label: "Person" },
      { value: "organization", label: "Organization" },
    ],
    default: "person",
  },
  separator: {
    type: "select" as const,
    label: "Title separator",
    description: "Character used between page title and site name in <title> tags",
    options: [
      { value: " — ", label: "— (em dash)" },
      { value: " | ", label: "| (pipe)" },
      { value: " - ", label: "- (hyphen)" },
      { value: " · ", label: "· (dot)" },
    ],
    default: " — ",
  },
  defaultDescription: {
    type: "string" as const,
    label: "Default meta description",
    description: "Fallback description for pages without their own",
    multiline: true,
  },
  personName: {
    type: "string" as const,
    label: "Person name",
    description: "Full name of the person this site represents",
  },
  personDescription: {
    type: "string" as const,
    label: "Person bio",
    description: "Short biography (max 250 characters for schema.org)",
    multiline: true,
  },
  personImageUrl: {
    type: "string" as const,
    label: "Person image URL",
    description: "URL to the person's photo",
  },
  personJobTitle: {
    type: "string" as const,
    label: "Person job title",
    description: "Job title for schema.org Person",
  },
  personUrl: {
    type: "string" as const,
    label: "Person URL",
    description: "URL to the person's about page or personal website",
  },
  orgName: {
    type: "string" as const,
    label: "Organization name",
    description: "Name of the organization (if site represents an organization)",
  },
  orgLogoUrl: {
    type: "string" as const,
    label: "Organization logo URL",
    description: "URL to the organization's logo",
  },
  socialTwitter: {
    type: "string" as const,
    label: "X (Twitter) URL",
    description: "Full profile URL (e.g. https://x.com/username)",
  },
  socialFacebook: {
    type: "string" as const,
    label: "Facebook URL",
    description: "Full profile URL",
  },
  socialLinkedIn: {
    type: "string" as const,
    label: "LinkedIn URL",
    description: "Full profile URL",
  },
  socialInstagram: {
    type: "string" as const,
    label: "Instagram URL",
    description: "Full profile URL",
  },
  socialYouTube: {
    type: "string" as const,
    label: "YouTube URL",
    description: "Full channel URL",
  },
  socialGitHub: {
    type: "string" as const,
    label: "GitHub URL",
    description: "Full profile URL",
  },
  socialBluesky: {
    type: "string" as const,
    label: "Bluesky URL",
    description: "Full profile URL",
  },
  socialMastodon: {
    type: "string" as const,
    label: "Mastodon URL",
    description: "Full profile URL",
  },
  socialWikipedia: {
    type: "string" as const,
    label: "Wikipedia URL",
    description: "Full article URL",
  },
  publishingPrinciples: {
    type: "string" as const,
    label: "Publishing principles URL",
    description: "URL to your editorial policy or publishing principles page",
  },
  copyrightYear: {
    type: "string" as const,
    label: "Copyright year",
    description: "Year copyright was first asserted (e.g. 2026)",
  },
  licenseUrl: {
    type: "string" as const,
    label: "License URL",
    description: "URL to content license (e.g. https://creativecommons.org/licenses/by/4.0/)",
  },
  blogUrl: {
    type: "string" as const,
    label: "Blog URL",
    description: "Full URL of the blog section (e.g. https://example.com/blog/). Enables Blog schema entity.",
  },
  blogName: {
    type: "string" as const,
    label: "Blog name",
    description: "Name for the Blog schema entity (defaults to \"Blog\")",
  },
  navigationItems: {
    type: "string" as const,
    label: "Navigation items (JSON)",
    description: "JSON array of {name, url} objects for SiteNavigationElement schema",
    multiline: true,
  },
  indexnowEnabled: {
    type: "select" as const,
    label: "IndexNow submission",
    description:
      "Submit published/unpublished URLs to IndexNow (Bing, Yandex, Seznam, Naver, Yep). A key is generated automatically on first use.",
    options: [
      { value: "false", label: "Disabled" },
      { value: "true", label: "Enabled" },
    ],
    default: "false",
  },
  llmsTxtEnabled: {
    type: "select" as const,
    label: "llms.txt (experimental)",
    description:
      "Expose an llms.txt index of published content on the plugin's llms/txt route. Wire a public /llms.txt Astro route to serve it.",
    options: [
      { value: "true", label: "Enabled" },
      { value: "false", label: "Disabled" },
    ],
    default: "true",
  },
  llmsTxtDescription: {
    type: "string" as const,
    label: "llms.txt site description",
    description:
      "Optional blurb rendered as the blockquote at the top of llms.txt. Falls back to the default meta description.",
    multiline: true,
  },
  nlwebEndpoint: {
    type: "string" as const,
    label: "NLWeb endpoint URL",
    description:
      "Absolute URL of your NLWeb (conversational) endpoint. When set, the plugin emits <link rel=\"nlweb\" href=\"...\"> on every page so agents can discover the chat surface.",
  },
};
