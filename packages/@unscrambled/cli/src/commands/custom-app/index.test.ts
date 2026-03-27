import { describe, expect, test } from "vitest";

import {
  buildCustomAppRequestPayload,
  hasCustomAppAuthTemplate,
  resolveCustomAppRequestUrl,
} from "./index";

describe("resolveCustomAppRequestUrl", () => {
  test("returns explicit url", () => {
    expect(
      resolveCustomAppRequestUrl({
        method: "GET",
        url: "https://api.github.com/user",
        query: [],
        header: [],
        output: "json",
      })
    ).toBe("https://api.github.com/user");
  });

  test("builds a full url from base url and path", () => {
    expect(
      resolveCustomAppRequestUrl({
        method: "GET",
        baseUrl: "https://api.notion.com",
        path: "/v1/users/me",
        query: [],
        header: [],
        output: "json",
      })
    ).toBe("https://api.notion.com/v1/users/me");
  });

  test("requires base url when using path", () => {
    expect(() =>
      resolveCustomAppRequestUrl({
        method: "GET",
        path: "/v1/users/me",
        query: [],
        header: [],
        output: "json",
      })
    ).toThrow(
      "When using --path for a custom app request, also provide --base-url <baseUrl>."
    );
  });
});

describe("buildCustomAppRequestPayload", () => {
  test("builds a request payload with auth name and json body", () => {
    expect(
      buildCustomAppRequestPayload({
        customAppName: "github",
        method: "POST",
        auth: "secondary",
        url: "https://api.github.com/user/repos",
        query: [{ key: "visibility", value: "private" }],
        header: [
          { key: "Authorization", value: "Bearer {{ accessToken }}" },
          { key: "X-Test", value: "true" },
        ],
        json: '{"name":"demo"}',
        output: "json",
      })
    ).toEqual({
      customAppName: "github",
      authName: "secondary",
      method: "POST",
      url: "https://api.github.com/user/repos",
      query: { visibility: "private" },
      headers: {
        Authorization: "Bearer {{ accessToken }}",
        "X-Test": "true",
        "Content-Type": "application/json",
      },
      body: '{"name":"demo"}',
    });
  });

  test("requires an auth header template", () => {
    expect(() =>
      buildCustomAppRequestPayload({
        customAppName: "github",
        method: "GET",
        url: "https://api.github.com/user",
        query: [],
        header: [{ key: "X-Test", value: "true" }],
        output: "json",
      })
    ).toThrow("Custom app requests must include an auth header template");
  });

  test("requires custom app name", () => {
    expect(() =>
      buildCustomAppRequestPayload({
        method: "GET",
        url: "https://api.github.com/user",
        query: [],
        header: [{ key: "Authorization", value: "Bearer {{ accessToken }}" }],
        output: "json",
      })
    ).toThrow("customAppName is required");
  });
});

describe("hasCustomAppAuthTemplate", () => {
  test("matches bearer token templates", () => {
    expect(
      hasCustomAppAuthTemplate({
        Authorization: "Bearer {{ accessToken }}",
      })
    ).toBe(true);
  });

  test("matches basic auth helper templates", () => {
    expect(
      hasCustomAppAuthTemplate({
        Authorization: "{{basicAuth username password}}",
      })
    ).toBe(true);
  });

  test("matches extraData templates", () => {
    expect(
      hasCustomAppAuthTemplate({
        "X-Workspace": "{{ extraData.workspaceId }}",
      })
    ).toBe(true);
  });

  test("does not match plain headers", () => {
    expect(
      hasCustomAppAuthTemplate({
        Authorization: "Bearer abc123",
      })
    ).toBe(false);
  });
});
