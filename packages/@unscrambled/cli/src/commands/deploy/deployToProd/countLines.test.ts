import { describe, expect, test } from "vitest";
import countLines from "./countLines";

describe("countLines", () => {
  test("three lines", () => {
    expect(countLines("one\ntwo\nthree\n")).toEqual(3);
  });

  test("one line", () => {
    expect(countLines("one\n")).toEqual(1);
  });

  test("blank", () => {
    expect(countLines("")).toEqual(0);
  });
});
