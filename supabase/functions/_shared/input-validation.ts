/**
 * Server-side input validation utilities for edge functions.
 * Pure TypeScript — no Deno or Node runtime imports.
 * Importable from both Deno edge functions and vitest.
 */

export const ALLOWED_TEMPLATES = ["minimalist", "executive", "tech", "corporate"] as const;
export type AllowedTemplate = typeof ALLOWED_TEMPLATES[number];

const DEFAULT_ACCENT = "#475569";
const DEFAULT_TEMPLATE: AllowedTemplate = "minimalist";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,6}$/;

/** Injection trigger words that indicate a prompt injection attempt. */
const INJECTION_PREFIXES = [
  "ignore ",
  "forget ",
  "you are now",
  "from now on",
  "disregard ",
  "override ",
  "system:",
  "assistant:",
];

/**
 * SECURITY: Validate that accentColor is a safe CSS hex color.
 * Returns DEFAULT_ACCENT for any input that doesn't match the hex format.
 */
export function validateAccentColor(color: unknown): string {
  if (typeof color !== "string") return DEFAULT_ACCENT;
  return HEX_COLOR_RE.test(color) ? color : DEFAULT_ACCENT;
}

/**
 * SECURITY: Validate that template is one of the four allowed names.
 * Returns "minimalist" for any unknown value.
 */
export function validateTemplate(template: unknown): AllowedTemplate {
  if (typeof template !== "string") return DEFAULT_TEMPLATE;
  return (ALLOWED_TEMPLATES as readonly string[]).includes(template)
    ? (template as AllowedTemplate)
    : DEFAULT_TEMPLATE;
}

/**
 * Tiers that are considered paid/Pro-equivalent.
 * "enterprise" and any future paid tiers are included so they are not
 * accidentally blocked when a Pro check is enforced.
 */
const PAID_TIERS = new Set(["pro", "enterprise"]);

/**
 * IMPORTANT-4: Server-side subscription enforcement.
 * Call this after determining the user's tier. If `requirePro` is true and
 * the tier is not a paid tier, the request is blocked with a clear error.
 */
export function checkSubscriptionAccess(
  tier: string,
  requirePro: boolean,
): { allowed: boolean; error?: string } {
  if (!requirePro) return { allowed: true };
  if (PAID_TIERS.has(tier)) return { allowed: true };
  return {
    allowed: false,
    error: "This feature requires a Pro subscription. Upgrade at usehunter.app/settings.",
  };
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Build a pair of synthetic conversation turns that deliver community questions
 * as user-turn context rather than system-prompt instructions.
 *
 * This keeps user-controlled content out of the privileged system prompt,
 * so even a question that slips sanitization cannot override Dexter's instructions.
 *
 * Returns an empty array when there are no questions.
 */
export function buildCommunityQuestionsContext(
  questions: string[],
  company: string,
): ChatMessage[] {
  if (questions.length === 0) return [];

  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return [
    {
      role: "user",
      content: `Before we start, here are questions that candidates report being asked at ${company || "this company"}. Please weave relevant ones naturally into our session:\n\n${numbered}`,
    },
    {
      role: "assistant",
      content: "Got it — I'll incorporate those into our session where they fit naturally.",
    },
  ];
}

/**
 * SECURITY: Sanitize client-supplied communityQuestions before embedding
 * in the AI system prompt. Removes non-strings, trims, enforces length
 * limits, and strips prompt injection attempts.
 */
export function sanitizeCommunityQuestions(questions: unknown): string[] {
  if (!Array.isArray(questions)) return [];

  return questions
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .filter((q) => {
      const lower = q.toLowerCase();
      return !INJECTION_PREFIXES.some((prefix) => lower.startsWith(prefix));
    })
    .map((q) => q.substring(0, 200))
    .slice(0, 12);
}
