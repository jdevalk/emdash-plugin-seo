import type { PublicPageContext, TaxonomyTerm } from "emdash";

export interface PageTerms {
  keywords: string[];
  articleSection: string | undefined;
}

export async function fetchPageTerms(page: PublicPageContext): Promise<PageTerms> {
  const empty: PageTerms = { keywords: [], articleSection: undefined };

  if (page.kind !== "content" || !page.content) return empty;

  try {
    const { getEmDashEntry } = await import("emdash");
    const { entry } = await getEmDashEntry(page.content.collection, page.content.id);
    if (!entry) return empty;

    const termsMap = (entry.data as Record<string, unknown>).terms as
      | Record<string, TaxonomyTerm[]>
      | undefined;
    if (!termsMap) return empty;

    const keywords = Object.values(termsMap).flat().map((t) => t.name);

    const categoryKey = Object.keys(termsMap).find((k) => /^categor/i.test(k));
    const articleSection = categoryKey ? termsMap[categoryKey][0]?.name : undefined;

    return { keywords, articleSection };
  } catch {
    return empty;
  }
}
