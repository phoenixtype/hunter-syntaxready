import { describe, it, expect } from "vitest";
import { isValidATSResumeData } from "@/lib/ats_types";

describe("ATSResumeData validation", () => {
  it("accepts valid data", () => {
    expect(isValidATSResumeData({
      fullName: "Jane Doe",
      email: "jane@test.com",
      phone: null,
      location: "NYC",
      summary: null,
      skills: ["React", "TypeScript"],
      workExperience: [],
      education: [],
    })).toBe(true);
  });

  it("rejects non-object", () => {
    expect(isValidATSResumeData(null)).toBe(false);
    expect(isValidATSResumeData("string")).toBe(false);
  });

  it("rejects missing skills array", () => {
    expect(isValidATSResumeData({
      fullName: "Jane",
      email: null,
      phone: null,
      location: null,
      summary: null,
      skills: "not-an-array",
      workExperience: [],
      education: [],
    })).toBe(false);
  });
});
