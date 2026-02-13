import { describe, it, expect } from "vitest";
import { translateError } from "./errors.js";

describe("translateError", () => {
  it("translates 401 Unauthorized", () => {
    const result = translateError(401, "Unauthorized");
    expect(result).toContain("GUPSHUP_PARTNER_TOKEN");
  });

  it("translates 429 rate limit", () => {
    const result = translateError(429, "Too Many Requests");
    expect(result).toContain("Rate limited");
  });

  it("translates invalid app id", () => {
    const result = translateError(400, "Invalid app id provided");
    expect(result).toContain("list_apps");
  });

  it("translates enableSample required", () => {
    const result = translateError(400, "enableSample is required");
    expect(result).toContain("example");
  });

  it("translates analytics not enabled", () => {
    const result = translateError(400, "Template analytics not enabled");
    expect(result).toContain("enable_template_analytics");
  });

  it("returns original message for unknown errors", () => {
    const result = translateError(500, "Something weird happened");
    expect(result).toContain("Something weird happened");
  });
});
