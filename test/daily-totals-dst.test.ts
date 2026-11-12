import { describe, expect, it } from "vitest";
import { apiOrder, dailyTotals, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("GET /customers/:id/daily-totals — переход на летнее и зимнее время", () => {
  it("день считается по смещению таймзоны на момент заказа (переход на летнее время)", async () => {
    // Europe/Berlin: до 29.03.2026 01:00Z — UTC+1, после — UTC+2
    ctx.api.customers.set("c_7", "Europe/Berlin");
    const o = (amount: number, createdAt: string) => apiOrder({ customerId: "c_7", amount, createdAt });
    await postWebhook(ctx.app, o(100, "2026-03-27T22:30:00Z")); // 23:30 27-го (UTC+1)
    await postWebhook(ctx.app, o(200, "2026-03-27T23:30:00Z")); // 00:30 28-го (UTC+1)
    await postWebhook(ctx.app, o(400, "2026-03-29T21:30:00Z")); // 23:30 29-го (UTC+2)
    await postWebhook(ctx.app, o(800, "2026-03-29T22:30:00Z")); // 00:30 30-го (UTC+2)

    const res = await dailyTotals(ctx.app, "c_7", "2026-03-27", "2026-03-30");
    expect(res.json()).toEqual([
      { date: "2026-03-27", total: 100 },
      { date: "2026-03-28", total: 200 },
      { date: "2026-03-29", total: 400 },
      { date: "2026-03-30", total: 800 },
    ]);
  });

  it("переход на зимнее время", async () => {
    // Europe/Berlin: до 25.10.2026 01:00Z — UTC+2, после — UTC+1
    ctx.api.customers.set("c_7", "Europe/Berlin");
    await postWebhook(ctx.app, apiOrder({ customerId: "c_7", amount: 100, createdAt: "2026-10-24T22:30:00Z" })); // 00:30 25-го
    await postWebhook(ctx.app, apiOrder({ customerId: "c_7", amount: 200, createdAt: "2026-10-25T22:30:00Z" })); // 23:30 25-го
    const res = await dailyTotals(ctx.app, "c_7", "2026-10-24", "2026-10-26");
    expect(res.json()).toEqual([
      { date: "2026-10-24", total: 0 },
      { date: "2026-10-25", total: 300 },
      { date: "2026-10-26", total: 0 },
    ]);
  });
});
