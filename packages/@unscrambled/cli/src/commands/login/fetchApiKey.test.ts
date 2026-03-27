import { describe, expect, test } from "vitest";

import { extractApiKeyFromLoginResponse } from "./fetchApiKey";

describe("extractApiKeyFromLoginResponse", () => {
  test("reads legacy UNSCRAMBLED_API_KEY responses", () => {
    expect(
      extractApiKeyFromLoginResponse({
        UNSCRAMBLED_API_KEY: "legacy-key",
      })
    ).toBe("legacy-key");
  });

  test("reads top-level apiKey responses", () => {
    expect(
      extractApiKeyFromLoginResponse({
        apiKey: "top-level-key",
      })
    ).toBe("top-level-key");
  });

  test("reads LIGHTYEAR_API_KEY responses for backward compatibility", () => {
    expect(
      extractApiKeyFromLoginResponse({
        LIGHTYEAR_API_KEY: "lightyear-key",
      })
    ).toBe("lightyear-key");
  });

  test("reads nested data.apiKey responses", () => {
    expect(
      extractApiKeyFromLoginResponse({
        data: {
          apiKey: "nested-key",
        },
      })
    ).toBe("nested-key");
  });

  test("reads nested data.LIGHTYEAR_API_KEY responses", () => {
    expect(
      extractApiKeyFromLoginResponse({
        data: {
          LIGHTYEAR_API_KEY: "nested-lightyear-key",
        },
      })
    ).toBe("nested-lightyear-key");
  });

  test("returns undefined when no api key is present", () => {
    expect(
      extractApiKeyFromLoginResponse({
        message: "ok",
      })
    ).toBeUndefined();
  });
});
