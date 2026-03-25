import { describe, expect, test } from "vitest";

import {
  buildAppRequestPayload,
  parseHeaderOption,
  parseQueryOption,
} from "./index";

describe("app request option parsers", () => {
  test("parses query pairs", () => {
    expect(parseQueryOption("limit=10")).toEqual({
      key: "limit",
      value: "10",
    });
  });

  test("parses header pairs", () => {
    expect(parseHeaderOption("X-Test: true")).toEqual({
      key: "X-Test",
      value: "true",
    });
  });

  test("rejects malformed query pairs", () => {
    expect(() => parseQueryOption("limit")).toThrow(
      "--query must be in the form key=value"
    );
  });

  test("rejects malformed header pairs", () => {
    expect(() => parseHeaderOption("Authorization")).toThrow(
      "--header must be in the form key:value"
    );
  });
});

describe("buildAppRequestPayload", () => {
  test("builds a request payload with query, headers, and json body", () => {
    expect(
      buildAppRequestPayload({
        method: "POST",
        path: "/crm/v3/objects/contacts",
        query: [{ key: "limit", value: "10" }],
        header: [{ key: "X-Test", value: "true" }],
        json: '{"name":"Acme"}',
        output: "json",
      })
    ).toEqual({
      method: "POST",
      path: "/crm/v3/objects/contacts",
      query: { limit: "10" },
      headers: { "X-Test": "true" },
      body: undefined,
      json: { name: "Acme" },
    });
  });

  test("rejects json and body together", () => {
    expect(() =>
      buildAppRequestPayload({
        method: "POST",
        path: "/crm/v3/objects/contacts",
        query: [],
        header: [],
        json: '{"name":"Acme"}',
        body: "raw",
        output: "json",
      })
    ).toThrow("Use either --json or --body, not both");
  });

  test("rejects invalid json", () => {
    expect(() =>
      buildAppRequestPayload({
        method: "POST",
        path: "/crm/v3/objects/contacts",
        query: [],
        header: [],
        json: "{bad-json}",
        output: "json",
      })
    ).toThrow("Invalid JSON provided to --json");
  });
});
