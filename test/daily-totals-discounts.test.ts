import { describe, expect, it } from "vitest";
import { apiOrder, dailyTotals, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("GET /customers/:id/daily-totals — скидки", () => {
  it("gross, discount и net с точностью до копейки", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 4870, discountPercent: 3, amountPaid: 4723.9 }));
    await postWebhook(ctx.app, apiOrder({ amount: "1467.00", discountPercent: "17", amountPaid: 1217.61 }));
    await postWebhook(ctx.app, apiOrder({ amount: 500, discountPercent: 0, amountPaid: 500 }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 6837, gross: 6837, discount: 395.49, net: 6441.51 }]);
  });

  it("нулевая скидка — это данные о скидке: поля есть, discount = 0", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 500, discountPercent: 0, amountPaid: 500 }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 500, gross: 500, discount: 0, net: 500 }]);
  });

  it("смешанный день: у заказа без полей скидки net = gross", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 1000 }));
    await postWebhook(ctx.app, apiOrder({ amount: 2000, discountPercent: 25, amountPaid: "1500.00" }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 3000, gross: 3000, discount: 500, net: 2500 }]);
  });

  it("есть процент, но нет amountPaid: net считается от суммы", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 1467, discountPercent: 17 }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 1467, gross: 1467, discount: 249.39, net: 1217.61 }]);
  });

  it("день без данных о скидке и день без заказов — прежний формат { date, total }", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 1000, createdAt: "2026-02-10T10:00:00Z" }));
    await postWebhook(ctx.app, apiOrder({ amount: 2000, discountPercent: 10, amountPaid: 1800, createdAt: "2026-02-12T10:00:00Z" }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-12");
    expect(res.json()).toEqual([
      { date: "2026-02-10", total: 1000 },
      { date: "2026-02-11", total: 0 },
      { date: "2026-02-12", total: 2000, gross: 2000, discount: 200, net: 1800 },
    ]);
  });

  it("скидки pending и refunded не учитываются", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 700, discountPercent: 10, amountPaid: 630, status: "pending" }));
    await postWebhook(ctx.app, apiOrder({ amount: 900, discountPercent: 10, amountPaid: 810, status: "refunded" }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 0 }]);
  });
});
