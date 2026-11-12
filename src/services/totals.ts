import type { OrdersRepository } from "../repositories/orders.js";
import { fromKop } from "../utils/money.js";
import { dateAtOffset, datesBetween, tzOffsetMinutes } from "../utils/time.js";
import type { CustomersService } from "./customers.js";

export interface DailyTotal {
  date: string;
  total: number;
  /** gross, discount, net — только для дней, по которым есть данные о скидке. */
  gross?: number;
  discount?: number;
  net?: number;
}

const DAY = 86_400_000;

export class TotalsService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly customers: CustomersService,
  ) {}

  /**
   * Сумма оплаченных заказов клиента по дням в его таймзоне, from..to включительно:
   * gross — до скидки, net — фактически заплачено, discount = gross - net, total = gross (совместимость).
   * gross, discount, net отдаются для дня, если хотя бы по одному его заказу есть данные о скидке.
   * Дни без оплат — с нулём.
   */
  async daily(customerId: string, from: string, to: string): Promise<DailyTotal[]> {
    const timezone = await this.customers.timezone(customerId);

    // Смещения таймзон в пределах ±14 ч: берём с запасом в сутки с каждой стороны
    const rows = await this.orders.paidCreatedBetween(
      customerId,
      new Date(Date.parse(`${from}T00:00:00Z`) - DAY),
      new Date(Date.parse(`${to}T00:00:00Z`) + 2 * DAY),
    );

    const sums = new Map(datesBetween(from, to).map((d) => [d, { gross: 0, net: 0, known: false }]));
    for (const o of rows) {
      // Смещение — на момент заказа: внутри периода может быть переход на летнее/зимнее время
      const day = sums.get(dateAtOffset(o.createdAt, tzOffsetMinutes(timezone, o.createdAt)));
      if (!day) continue;
      day.gross += o.amountKop;
      day.net += o.amountPaidKop ?? o.amountKop;
      day.known ||= o.amountPaidKop !== null;
    }
    // Без данных о скидке ответ прежний ({ date, total }): существующие клиенты сравнивают его строго
    return [...sums].map(([date, { gross, net, known }]) => ({
      date,
      total: fromKop(gross),
      ...(known && { gross: fromKop(gross), discount: fromKop(gross - net), net: fromKop(net) }),
    }));
  }
}
