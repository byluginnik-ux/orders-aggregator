import { describe, expect, it } from "vitest";
import { apiOrder, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("POST /webhooks/order — параллельная доставка", () => {
  it("параллельные версии одного заказа: остаётся самая новая", async () => {
    for (let i = 0; i < 20; i++) {
      const o = apiOrder({ status: "pending", updatedAt: "2026-02-10T12:00:00Z" });
      await postWebhook(ctx.app, o);
      const older = { ...o, status: "paid", updatedAt: "2026-02-10T13:00:00Z" };
      const newer = { ...o, status: "refunded", updatedAt: "2026-02-10T14:00:00Z" };
      const sent = [newer, older, newer, older, older, newer];
      const results = await Promise.all(sent.map((v) => postWebhook(ctx.app, v)));
      const resultsOf = (v: object) => results.filter((_, k) => sent[k] === v).map((r) => r.json().result).sort();
      // новая версия применяется ровно один раз, её дубли — stale
      expect(resultsOf(newer)).toEqual(["stale", "stale", "updated"]);
      // старая — не больше одного раза (если успела раньше новой)
      expect(resultsOf(older).filter((r) => r === "updated").length).toBeLessThanOrEqual(1);
      const { rows } = await ctx.db.query(`SELECT status, updated_at FROM orders WHERE id = $1`, [o.id]);
      expect(rows[0]).toEqual({ status: "refunded", updated_at: new Date("2026-02-10T14:00:00Z") });
    }
  });

  it("параллельные дубли нового заказа: создаётся один раз", async () => {
    const o = apiOrder();
    const results = await Promise.all([o, o, o, o].map((v) => postWebhook(ctx.app, v)));
    expect(results.map((r) => r.json().result).sort()).toEqual(["created", "stale", "stale", "stale"]);
  });
});
