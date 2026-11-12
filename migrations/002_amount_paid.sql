-- Фактически заплачено (amountPaid внешнего API), копейки. NULL — данных о скидке нет, считаем равным amount_kop.
ALTER TABLE orders ADD COLUMN amount_paid_kop BIGINT;
