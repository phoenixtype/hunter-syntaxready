import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import PostInterview from "../pages/PostInterview";

// ── Minimal mocks ────────────────────────────────────────────────────────────

vi.mock("../hooks/useResume", () => ({
  useResume: () => ({
    profile: { identity: { name: "Ada Lovelace" }, skills: [], experience_atoms: [], education: [] },
  }),
}));

vi.mock("../hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, canAccess: () => true }),
}));

// ProGate.Page renders children when isPro is true
vi.mock("../components/ProGate", () => ({
  default: {
    Page: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

vi.mock("../components/PageTour", () => ({
  default: vi.fn(() => null),
}));

// Mock Tabs to always render all panels — avoids Radix pointer-event dependencies in jsdom
vi.mock("../components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button role="tab" data-value={value}>{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/PageHeader", () => ({
  default: () => <div data-testid="page-header" />,
}));

vi.mock("../components/SEOHead", () => ({
  default: () => null,
}));

vi.mock("../lib/post_interview_engine", () => ({
  generateThankYouNote: vi.fn().mockResolvedValue("Dear Sarah,\nThank you..."),
  generateNegotiationStrategy: vi.fn().mockResolvedValue({
    leveragePoints: ["Strong portfolio"],
    script: "Here is my counter...",
    recommendedCounter: "Recommended counter: $145,000",
  }),
  generateNegotiationScript: vi.fn().mockResolvedValue("Phone script content..."),
}));

const renderPage = () =>
  render(
    <BrowserRouter>
      <PostInterview />
    </BrowserRouter>
  );

// ── IMPORTANT-7: Thank-you note form collects job title ───────────────────────

describe("Thank You Note form", () => {
  beforeEach(() => renderPage());

  it("has a Job Title field", () => {
    expect(screen.getByTestId("thankyou-jobtitle")).toBeInTheDocument();
  });

  it("passes the entered job title (not 'Candidate') to the generator", async () => {
    const { generateThankYouNote } = await import("../lib/post_interview_engine");

    // Two "e.g. Stripe" inputs exist (thank-you + negotiation panels both rendered).
    // The thank-you Company input is first in DOM order.
    fireEvent.change(screen.getAllByPlaceholderText(/e\.g\. Stripe/i)[0], {
      target: { value: "Stripe" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sarah Connor/i), {
      target: { value: "Sarah" },
    });
    fireEvent.change(screen.getByTestId("thankyou-jobtitle"), {
      target: { value: "Senior Engineer" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Scalability, Culture/i), {
      target: { value: "System design" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Generate Thank You Note/i }));

    await vi.waitFor(() => {
      expect(generateThankYouNote).toHaveBeenCalledWith(
        "Sarah",
        "Stripe",
        "Senior Engineer",
        expect.any(Array),
        expect.any(Object)
      );
      // Must NOT be called with the hardcoded "Candidate" placeholder
      expect(generateThankYouNote).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "Candidate",
        expect.any(Array),
        expect.any(Object)
      );
    });
  });
});

// ── IMPORTANT-5: Negotiation form collects equity and bonus ───────────────────

describe("Negotiation Coach form", () => {
  it("has an Equity field in the DOM", () => {
    renderPage();
    expect(screen.getByTestId("neg-equity")).toBeInTheDocument();
  });

  it("has a Bonus field in the DOM", () => {
    renderPage();
    expect(screen.getByTestId("neg-bonus")).toBeInTheDocument();
  });

  it("passes entered equity and bonus (not hardcoded 0.5% / 10%) to the strategy generator", async () => {
    renderPage();

    const { generateNegotiationStrategy } = await import("../lib/post_interview_engine");

    // All panels are in the DOM (Tabs mocked). Two "e.g. Stripe" inputs exist —
    // the negotiation one is identified via its sibling (baseSalary placeholder).
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 120000/i), { target: { value: "130000" } });
    // Target the negotiation company field specifically using the aria-label on negCompany section
    const allStripeInputs = screen.getAllByPlaceholderText(/e\.g\. Stripe/i);
    fireEvent.change(allStripeInputs[allStripeInputs.length - 1], { target: { value: "Acme Corp" } });
    fireEvent.change(screen.getByTestId("neg-equity"), { target: { value: "1.5%" } });
    fireEvent.change(screen.getByTestId("neg-bonus"), { target: { value: "15%" } });

    fireEvent.click(screen.getByRole("button", { name: /Analyze Offer/i }));

    await vi.waitFor(() => {
      expect(generateNegotiationStrategy).toHaveBeenCalledWith(
        expect.objectContaining({ equity: "1.5%", bonus: "15%" }),
        expect.any(Object)
      );
    });
  });
});
