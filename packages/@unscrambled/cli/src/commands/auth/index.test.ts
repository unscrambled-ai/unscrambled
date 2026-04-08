import { describe, expect, test } from "vitest";

import { buildAuthListEntries } from "./index";

describe("buildAuthListEntries", () => {
  test("includes built-in app auths and custom apps without auth rows", () => {
    const auths = buildAuthListEntries(
      {
        apps: [
          {
            id: "app-1",
            name: "hubspot",
            title: "HubSpot",
            authType: "OAUTH2",
            auths: [
              {
                id: "auth-1",
                name: "default",
                authorized: true,
                apiKeySet: false,
                isLinkedToAuth: false,
              },
            ],
          },
        ],
        customApps: [
          {
            id: "custom-1",
            name: "granola",
            title: "Granola",
            authType: "APIKEY",
            authorized: false,
          },
        ],
      },
      {
        granola: {
          id: "custom-1",
          name: "granola",
          title: "Granola",
          authType: "APIKEY",
          auths: [],
        },
      }
    );

    expect(auths).toEqual([
      {
        service: "granola",
        authName: "default",
        authType: "APIKEY",
        status: "pending",
        resourceType: "custom-app",
      },
      {
        service: "hubspot",
        authName: "default",
        authType: "OAUTH2",
        status: "connected",
        resourceType: "app",
      },
    ]);
  });

  test("uses custom-app detail auth rows when present", () => {
    const auths = buildAuthListEntries(
      {
        apps: [],
        customApps: [
          {
            id: "custom-1",
            name: "granola",
            title: "Granola",
            authType: "APIKEY",
            authorized: true,
          },
        ],
      },
      {
        granola: {
          id: "custom-1",
          name: "granola",
          title: "Granola",
          authType: "APIKEY",
          auths: [
            {
              id: "auth-1",
              name: "granola",
              status: "AUTHORIZED",
              error: null,
              apiKeySet: true,
              passwordSet: false,
              linkedToAuth: null,
            },
          ],
        },
      }
    );

    expect(auths).toEqual([
      {
        service: "granola",
        authName: "granola",
        authType: "APIKEY",
        status: "connected",
        resourceType: "custom-app",
      },
    ]);
  });

  test("maps custom-app error auths to error status", () => {
    const auths = buildAuthListEntries(
      {
        apps: [],
        customApps: [
          {
            id: "custom-1",
            name: "granola",
            title: "Granola",
            authType: "APIKEY",
            authorized: false,
          },
        ],
      },
      {
        granola: {
          id: "custom-1",
          name: "granola",
          title: "Granola",
          authType: "APIKEY",
          auths: [
            {
              id: "auth-1",
              name: "granola",
              status: "ERROR",
              error: "Missing API key",
              apiKeySet: false,
              passwordSet: false,
              linkedToAuth: null,
            },
          ],
        },
      }
    );

    expect(auths).toEqual([
      {
        service: "granola",
        authName: "granola",
        authType: "APIKEY",
        status: "error",
        resourceType: "custom-app",
      },
    ]);
  });
});
