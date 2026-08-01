/**
 * ADDED (ATS Score feature) — deterministic ATS scoring engine.
 *
 * Pure, dependency-free heuristics so it can run on the edge runtime.
 * Swap `scoreResume` for an AI/vendor call later; the return shape is stable.
 */

export interface AtsBreakdownItem {
  key: string;
  label: string;
  score: number; // 0..100
  weight: number; // 0..1
  hint: string;
}

export interface AtsResult {
  score: number; // 0..100
  verdict: "excellent" | "good" | "average" | "poor";
  breakdown: AtsBreakdownItem[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  wordCount: number;
  usedJobDescription: boolean;
}

const SECTION_HINTS = [
  "experience",
  "education",
  "skills",
  "projects",
  "summary",
  "certification",
  "achievement",
];

const ACTION_VERBS = [
  "led",
  "built",
  "designed",
  "developed",
  "implemented",
  "launched",
  "improved",
  "reduced",
  "increased",
  "owned",
  "delivered",
  "automated",
  "optimized",
  "managed",
  "created",
];

const STOP_WORDS = new Set(
  `a an and are as at be by for from has have in into is it its of on or that the to with we you your our their will who what when which they them this those these must should can able role job work working years year experience strong good excellent using use used across via etc`.split(
    /\s+/,
  ),
);

function normalize(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[\u2018\u2019]/g, "'").toLowerCase();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function pct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Top keywords of a job description, ranked by frequency. */
export function extractKeywords(jd: string, limit = 24): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens(jd)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

export function scoreResume(resumeText: string, jobDescription?: string | null): AtsResult {
  const text = resumeText || "";
  const lower = normalize(text);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const jd = (jobDescription || "").trim();
  const usedJobDescription = jd.length > 40;

  // 1. Structure — recognizable sections
  const foundSections = SECTION_HINTS.filter((s) => lower.includes(s));
  const structure = pct((foundSections.length / SECTION_HINTS.length) * 100);

  // 2. Contact info — parsers need email + phone
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  const hasPhone = /(\+?\d[\d\s-]{8,}\d)/.test(text);
  const hasLink = /(linkedin\.com|github\.com|https?:\/\/)/i.test(text);
  const contact = pct((Number(hasEmail) * 50 + Number(hasPhone) * 35 + Number(hasLink) * 15));

  // 3. Length — 400–900 words is the ATS sweet spot
  let length = 100;
  if (wordCount < 200) length = 35;
  else if (wordCount < 400) length = 70;
  else if (wordCount > 1200) length = 55;
  else if (wordCount > 900) length = 80;

  // 4. Impact — quantified results and action verbs
  const numberMatches = text.match(/\b\d+(\.\d+)?\s?(%|percent|k\b|x\b|\+)/gi) ?? [];
  const verbHits = ACTION_VERBS.filter((v) => new RegExp(`\\b${v}`, "i").test(text)).length;
  const impact = pct(Math.min(100, numberMatches.length * 12 + verbHits * 7));

  // 5. Formatting — ATS parsers choke on tables, images and odd glyphs
  const oddChars = (text.match(/[^\x09\x0a\x0d\x20-\x7e]/g) ?? []).length;
  const bulletLines = text.split("\n").filter((l) => /^\s*[-•*\u2022]/.test(l)).length;
  const formatting = pct(100 - Math.min(45, oddChars / Math.max(1, wordCount / 40) * 10) + Math.min(15, bulletLines));

  // 6. Keyword match (JD optional) — falls back to generic skill density
  const resumeSet = new Set(tokens(text));
  let matchedKeywords: string[] = [];
  let missingKeywords: string[] = [];
  let keywordScore: number;

  if (usedJobDescription) {
    const kws = extractKeywords(jd);
    matchedKeywords = kws.filter((k) => resumeSet.has(k));
    missingKeywords = kws.filter((k) => !resumeSet.has(k));
    keywordScore = pct((matchedKeywords.length / Math.max(1, kws.length)) * 100);
  } else {
    const density = resumeSet.size / Math.max(1, wordCount);
    keywordScore = pct(45 + density * 180);
  }

  const breakdown: AtsBreakdownItem[] = [
    {
      key: "keywords",
      label: usedJobDescription ? "Job-description match" : "Keyword strength",
      score: keywordScore,
      weight: usedJobDescription ? 0.32 : 0.22,
      hint: usedJobDescription
        ? "How many of the role's key terms appear in your resume."
        : "Add a job description for a precise, role-specific match."
    },
    {
      key: "structure",
      label: "Section structure",
      score: structure,
      weight: 0.18,
      hint: "Clear Experience, Education, Skills and Projects headings.",
    },
    {
      key: "impact",
      label: "Impact & metrics",
      score: impact,
      weight: usedJobDescription ? 0.18 : 0.24,
      hint: "Quantified achievements beat responsibility lists.",
    },
    {
      key: "contact",
      label: "Contact & links",
      score: contact,
      weight: 0.12,
      hint: "Email, phone and a LinkedIn/GitHub link should be plain text.",
    },
    {
      key: "formatting",
      label: "ATS-safe formatting",
      score: formatting,
      weight: 0.1,
      hint: "Avoid tables, columns, images and unusual symbols.",
    },
    {
      key: "length",
      label: "Length balance",
      score: length,
      weight: usedJobDescription ? 0.1 : 0.14,
      hint: "Aim for 400–900 words (1–2 pages).",
    },
  ];

  const total = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const score = pct(total);

  const suggestions: string[] = [];
  if (keywordScore < 70 && usedJobDescription) {
    suggestions.push(
      `Weave in missing terms naturally: ${missingKeywords.slice(0, 6).join(", ") || "role-specific skills"}.`,
    );
  }
  if (!usedJobDescription) {
    suggestions.push("Paste a job description to get a role-specific match score.");
  }
  if (structure < 80) {
    const missing = SECTION_HINTS.filter((s) => !foundSections.includes(s)).slice(0, 3);
    suggestions.push(`Add clear headings for: ${missing.join(", ")}.`);
  }
  if (impact < 70) {
    suggestions.push("Start bullets with action verbs and add numbers (%, ₹, time saved, scale).");
  }
  if (contact < 85) {
    suggestions.push("Put your email, phone and LinkedIn URL as plain text at the top.");
  }
  if (formatting < 80) {
    suggestions.push("Remove tables, icons and special characters — parsers drop them.");
  }
  if (length < 80) {
    suggestions.push(
      wordCount < 400
        ? "Your resume looks thin — expand recent roles with 3–5 impact bullets each."
        : "Trim to the most relevant 1–2 pages.",
    );
  }
  if (suggestions.length === 0) {
    suggestions.push("Strong resume. Refresh it daily so recruiters keep seeing you at the top.");
  }

  const verdict: AtsResult["verdict"] =
    score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "average" : "poor";

  return {
    score,
    verdict,
    breakdown,
    matchedKeywords,
    missingKeywords,
    suggestions,
    wordCount,
    usedJobDescription,
  };
}
