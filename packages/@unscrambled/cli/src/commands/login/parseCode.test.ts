import { describe, expect, test } from "vitest";
import parseCode from "./parseCode";

describe("parseCode", () => {
  test("it works", () => {
    expect(parseCode("/?code=1f42faab-ded3-4fde-b341-51e6a9cbb5f5")).toEqual(
      "1f42faab-ded3-4fde-b341-51e6a9cbb5f5"
    );
  });

  test("it is undefined if no url", () => {
    expect(parseCode(undefined)).toBeUndefined();
  });

  test("it is undefined if bad URL", () => {
    expect(parseCode("/?code=1f42faab-ded3-4fde-b341-51e6a9cbb5f5")).toEqual(
      "1f42faab-ded3-4fde-b341-51e6a9cbb5f5"
    );
  });
});
