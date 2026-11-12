import { describe, expect, it } from "vitest";
import { toKop } from "../src/utils/money.js";

describe("toKop — точность", () => {
  it("не теряет копейку на погрешности double", () => {
    expect(toKop(4723.9)).toBe(472390);
    expect(toKop(1217.61)).toBe(121761);
    expect(toKop(1.15)).toBe(115);
  });
});
