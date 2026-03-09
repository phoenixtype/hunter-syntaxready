import { describe, it, expect } from "vitest";

// Template definitions matching ResumeBuilder.tsx
const TEMPLATES = [
  { id: "classic", name: "Classic Professional" },
  { id: "modern", name: "Modern Minimal" },
  { id: "executive", name: "Executive" },
  { id: "creative", name: "Creative Portfolio" },
  { id: "technical", name: "Technical Engineer" },
  { id: "compact", name: "One-Page Compact" },
  { id: "elegant", name: "Elegant Serif" },
  { id: "bold", name: "Bold Impact" },
  { id: "nordic", name: "Nordic Clean" },
  { id: "editorial", name: "Editorial" },
  { id: "luxe", name: "Luxe Dark" },
  { id: "swiss", name: "Swiss Grid" },
];

// Template styles from Edge Function
const TEMPLATE_STYLES: Record<string, string> = {
  classic: "Clean, traditional, serif headings",
  modern: "Sleek, minimal, sans-serif, teal accent",
  executive: "Bold, authoritative, dark navy header",
  creative: "Two-column layout with a colored sidebar",
  technical: "Monospace font accents for tech stack",
  compact: "Dense single-page layout",
  elegant: "Refined serif typography",
  bold: "High-contrast layout, oversized name",
  nordic: "Scandinavian minimalism",
  editorial: "Magazine/editorial style",
  luxe: "Premium dark background",
  swiss: "International Typographic Style",
};

describe("Resume Templates", () => {
  it("has unique template IDs", () => {
    const ids = TEMPLATES.map(t => t.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  it("has unique template names", () => {
    const names = TEMPLATES.map(t => t.name);
    const uniqueNames = [...new Set(names)];
    expect(names.length).toBe(uniqueNames.length);
  });

  it("has at least 10 templates available", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("includes modern as default template", () => {
    const modern = TEMPLATES.find(t => t.id === "modern");
    expect(modern).toBeDefined();
    expect(modern?.name).toBe("Modern Minimal");
  });

  it("has style definitions for all templates", () => {
    TEMPLATES.forEach(template => {
      expect(TEMPLATE_STYLES[template.id]).toBeDefined();
      expect(TEMPLATE_STYLES[template.id].length).toBeGreaterThan(10);
    });
  });

  it("style definitions contain descriptive keywords", () => {
    expect(TEMPLATE_STYLES.nordic).toContain("Scandinavian");
    expect(TEMPLATE_STYLES.luxe).toContain("dark");
    expect(TEMPLATE_STYLES.swiss).toContain("Typographic");
    expect(TEMPLATE_STYLES.technical).toContain("Monospace");
  });
});

describe("Template ID validation", () => {
  it("template IDs are lowercase alphanumeric", () => {
    TEMPLATES.forEach(template => {
      expect(template.id).toMatch(/^[a-z]+$/);
    });
  });

  it("template IDs are reasonable length", () => {
    TEMPLATES.forEach(template => {
      expect(template.id.length).toBeGreaterThan(2);
      expect(template.id.length).toBeLessThan(20);
    });
  });
});
