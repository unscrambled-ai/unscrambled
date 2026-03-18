import { describe, it, expect } from "vitest";
import { match } from "./match";

describe("Match patterns", () => {
  it("should create simple property match", () => {
    const pattern = match.property("email");
    expect(pattern).toBe("email");
  });

  it("should create JSON path match", () => {
    const pattern = match.jsonPath(".user.email");
    expect(pattern).toBe("$.user.email");
  });

  it("should create OR pattern", () => {
    const pattern = match.or("email", "username");
    expect(pattern).toEqual({
      or: ["email", "username"],
    });
  });

  it("should create AND pattern", () => {
    const pattern = match.and(
      match.property("type"),
      match.jsonPath(".status")
    );
    expect(pattern).toEqual({
      and: ["type", "$.status"],
    });
  });

  it("should create complex nested patterns", () => {
    const pattern = match.or(
      match.and("email", "verified"),
      match.jsonPath(".metadata.userId")
    );

    expect(pattern).toEqual({
      or: [
        {
          and: ["email", "verified"],
        },
        "$.metadata.userId",
      ],
    });
  });

  it("should handle multiple OR patterns", () => {
    const pattern = match.or(
      "email",
      "username",
      "phone",
      match.jsonPath(".identity.id")
    );

    expect(pattern).toEqual({
      or: ["email", "username", "phone", "$.identity.id"],
    });
  });

  it("should handle multiple AND patterns", () => {
    const pattern = match.and(
      "type",
      "status",
      "active",
      match.jsonPath(".metadata.valid")
    );

    expect(pattern).toEqual({
      and: ["type", "status", "active", "$.metadata.valid"],
    });
  });

  it("should handle deeply nested patterns", () => {
    const pattern = match.or(
      match.and(match.property("type"), match.or("status1", "status2")),
      match.and(match.jsonPath(".metadata.type"), match.property("active"))
    );

    expect(pattern).toEqual({
      or: [
        {
          and: [
            "type",
            {
              or: ["status1", "status2"],
            },
          ],
        },
        {
          and: ["$.metadata.type", "active"],
        },
      ],
    });
  });
});
