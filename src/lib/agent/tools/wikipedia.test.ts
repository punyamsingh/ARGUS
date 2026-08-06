import { describe, expect, it } from "vitest";
import {
  articleMatchesCompany,
  contradictsDomain,
  registrableDomain,
} from "./wikipedia";

/**
 * Entity-verification guards for the Wikipedia tool.
 *
 * Every rejection case below is a real search result observed against the live
 * API: Wikipedia never returns "no match", it returns a confident wrong one, and
 * the tool used to cite whichever came first. These lock that shut.
 */

describe("articleMatchesCompany", () => {
  it("rejects the unrelated articles Wikipedia returns for a company with no page", () => {
    // Observed for "Campus Activewear Ltd. company" — the mis-citation that
    // put THG plc (The Hut Group, UK) into a brief about an Indian footwear
    // brand, and for "Mamaearth", which returns people rather than companies.
    expect(articleMatchesCompany("THG plc", "Campus Activewear Ltd.")).toBe(false);
    expect(articleMatchesCompany("Target Corporation", "Campus Activewear Ltd.")).toBe(false);
    expect(articleMatchesCompany("Jordyn Woods", "Campus Activewear Ltd.")).toBe(false);
    expect(articleMatchesCompany("Shilpa Shetty", "Mamaearth")).toBe(false);
    expect(articleMatchesCompany("Shark Tank India season 5", "Honasa Consumer")).toBe(false);
  });

  it("accepts an article titled more fully than the resolved name", () => {
    expect(articleMatchesCompany("GitLab Inc.", "GitLab")).toBe(true);
    expect(articleMatchesCompany("Apple Inc.", "Apple")).toBe(true);
  });

  it("accepts a brand-titled article when resolution returned the legal entity", () => {
    // Both halves of the demo scenario and the FirstCry run.
    expect(
      articleMatchesCompany("Nykaa", "FSN E-Commerce Ventures Ltd. (Nykaa)"),
    ).toBe(true);
    expect(
      articleMatchesCompany("FirstCry", "FirstCry, operating as BrainBees Solutions Limited"),
    ).toBe(true);
  });

  it("matches exact and case/punctuation variants", () => {
    expect(articleMatchesCompany("Lenskart", "Lenskart")).toBe(true);
    expect(articleMatchesCompany("lenskart", "LENSKART")).toBe(true);
    expect(articleMatchesCompany("Zomato", "Zomato Ltd")).toBe(true);
  });

  it("does not match on a shared legal form alone", () => {
    // Stripping noise must not leave two unrelated names looking identical.
    expect(articleMatchesCompany("Acme Ltd", "Globex Ltd")).toBe(false);
    expect(articleMatchesCompany("Ltd", "Globex Ltd")).toBe(false);
  });

  it("rejects a partial-token overlap that isn't the same company", () => {
    expect(articleMatchesCompany("Bank of America", "America Movil")).toBe(false);
    expect(articleMatchesCompany("Tata Motors", "Tesla Motors")).toBe(false);
  });

  it("passes a subset name the title check cannot distinguish (domain guard's job)", () => {
    // "Campus" the German shoe brand is indistinguishable by name from the
    // legitimate brand-vs-legal-entity match ("Nykaa" ⊂ "FSN E-Commerce
    // Ventures Ltd. (Nykaa)"). Documented here so the split of responsibility
    // is explicit rather than an accident — `contradictsDomain` rejects it.
    expect(articleMatchesCompany("Campus (company)", "Campus Activewear Ltd.")).toBe(true);
    expect(contradictsDomain("https://campus.de", "campusshoes.com")).toBe(true);
  });

  it("handles empty and punctuation-only input without matching", () => {
    expect(articleMatchesCompany("", "Nykaa")).toBe(false);
    expect(articleMatchesCompany("Nykaa", "")).toBe(false);
    expect(articleMatchesCompany("—", "Nykaa")).toBe(false);
  });
});

describe("registrableDomain", () => {
  it("reduces a host to the part that identifies the owner", () => {
    expect(registrableDomain("gitlab.com")).toBe("gitlab.com");
    expect(registrableDomain("www.nykaa.com")).toBe("nykaa.com");
    expect(registrableDomain("about.gitlab.com")).toBe("gitlab.com");
  });

  it("strips scheme, path, port and query", () => {
    expect(registrableDomain("https://www.firstcry.com/careers")).toBe("firstcry.com");
    expect(registrableDomain("http://example.com:8080/a?b=c#d")).toBe("example.com");
  });

  it("keeps three labels for compound TLDs", () => {
    expect(registrableDomain("https://www.company.co.in")).toBe("company.co.in");
    expect(registrableDomain("shop.retailer.co.uk")).toBe("retailer.co.uk");
  });

  it("distinguishes genuinely different owners", () => {
    expect(registrableDomain("https://thg.com")).not.toBe(
      registrableDomain("https://campusshoes.com"),
    );
  });
});

describe("contradictsDomain", () => {
  it("rejects only when both sides know a domain and they disagree", () => {
    expect(contradictsDomain("https://thg.com", "campusshoes.com")).toBe(true);
  });

  it("passes when either side is unknown", () => {
    // A missing official website is the common case, not evidence of mismatch.
    expect(contradictsDomain(undefined, "firstcry.com")).toBe(false);
    expect(contradictsDomain("https://firstcry.com", undefined)).toBe(false);
    expect(contradictsDomain("", "")).toBe(false);
  });

  it("passes the subdomain and www variants of a genuine match", () => {
    expect(contradictsDomain("https://www.nykaa.com/", "nykaa.com")).toBe(false);
    expect(contradictsDomain("https://about.gitlab.com", "gitlab.com")).toBe(false);
  });
});
