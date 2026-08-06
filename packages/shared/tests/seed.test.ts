import { describe, expect, it } from "vitest";

import { parseSeed, SeedSchema } from "../src/index.js";

describe("SeedSchema", () => {
  it("accepts the boundary values of an unsigned 32-bit integer", () => {
    expect(parseSeed(0)).toBe(0);
    expect(parseSeed(0xffffffff)).toBe(0xffffffff);
  });

  it("rejects values outside the 32-bit range", () => {
    expect(() => parseSeed(-1)).toThrow();
    expect(() => parseSeed(0x100000000)).toThrow();
  });

  it("rejects non-integers and non-numbers", () => {
    expect(() => parseSeed(1.5)).toThrow();
    expect(() => parseSeed("42")).toThrow();
    expect(() => parseSeed(null)).toThrow();
  });

  it("reports failure without throwing when asked to", () => {
    expect(SeedSchema.safeParse(-1).success).toBe(false);
    expect(SeedSchema.safeParse(7).success).toBe(true);
  });
});
