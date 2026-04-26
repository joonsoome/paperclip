import { describe, expect, it } from "vitest";
import { normalizeMaxConcurrentRuns } from "../services/heartbeat.js";

describe("normalizeMaxConcurrentRuns", () => {
  it("defaults to 5 when value is missing or null", () => {
    expect(normalizeMaxConcurrentRuns(undefined)).toBe(5);
    expect(normalizeMaxConcurrentRuns(null)).toBe(5);
  });

  it("returns the value for in-range integers 1..10", () => {
    for (let v = 1; v <= 10; v++) {
      expect(normalizeMaxConcurrentRuns(v)).toBe(v);
    }
  });

  it("clamps values below 1 to 1", () => {
    expect(normalizeMaxConcurrentRuns(0)).toBe(1);
    expect(normalizeMaxConcurrentRuns(-1)).toBe(1);
    expect(normalizeMaxConcurrentRuns(-100)).toBe(1);
  });

  it("clamps values above 10 to 10", () => {
    expect(normalizeMaxConcurrentRuns(11)).toBe(10);
    expect(normalizeMaxConcurrentRuns(99)).toBe(10);
    expect(normalizeMaxConcurrentRuns(999)).toBe(10);
  });

  it("handles string numbers", () => {
    expect(normalizeMaxConcurrentRuns("3")).toBe(3);
    expect(normalizeMaxConcurrentRuns("0")).toBe(1);
    expect(normalizeMaxConcurrentRuns("15")).toBe(10);
  });

  it("handles floats by flooring", () => {
    expect(normalizeMaxConcurrentRuns(4.9)).toBe(4);
    expect(normalizeMaxConcurrentRuns(10.9)).toBe(10);
    expect(normalizeMaxConcurrentRuns(0.5)).toBe(1);
  });

  it("defaults to 5 for non-numeric values", () => {
    expect(normalizeMaxConcurrentRuns("abc")).toBe(5);
    expect(normalizeMaxConcurrentRuns(true)).toBe(1); // Number(true) === 1, clamped to range
    expect(normalizeMaxConcurrentRuns(true)).toBe(1); // Number(true) === 1, clamped to range
    expect(normalizeMaxConcurrentRuns({})).toBe(5);
    expect(normalizeMaxConcurrentRuns([])).toBe(5);
  });

  it("defaults to 5 for NaN and Infinity", () => {
    expect(normalizeMaxConcurrentRuns(NaN)).toBe(5);
    expect(normalizeMaxConcurrentRuns(Infinity)).toBe(5);
    expect(normalizeMaxConcurrentRuns(-Infinity)).toBe(5);
  });
});
