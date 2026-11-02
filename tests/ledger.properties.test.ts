import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
  CURRENCIES,
  expenseBreakdown,
  filterTransactions,
  formatCurrency,
  formatSheetDate,
  summarizeByCurrency,
  transactionSchema,
  type Currency,
} from "../lib/ledger.ts";

// FC_RUNS=20000 npm test for a deep pass.
const numRuns = Number(process.env.FC_RUNS ?? 300);
const check = (p: fc.IPropertyWithHooks<unknown[]>) => fc.assert(p, { numRuns });

const currency = fc.constantFrom(...CURRENCIES);
// Amounts are money: whole cents. Sums of up to ~50 such values stay far
// inside half a cent of the exact answer, so cent-rounding is the right oracle.
const amount = fc.integer({ min: 1, max: 100_000_000 }).map((c) => c / 100);
const cents = (n: number) => Math.round(n * 100);

const entry = fc.record({
  type: fc.constantFrom("income", "expense" as const),
  category: fc.constantFrom("Food", "Shopping", "Transport", "Bills", "Other", "Travel", "Food & Treats"),
  amount,
  note: fc.string({ maxLength: 20 }),
  currency,
});
const entries = fc.array(entry, { maxLength: 50 });

const DAY = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const serialDay = fc.integer({ min: 1, max: 100_000 });

// ---- formatSheetDate -------------------------------------------------------

test("empty and missing sheet cells give an empty date", () => {
  assert.equal(formatSheetDate(undefined), "");
  assert.equal(formatSheetDate(""), "");
});

test("text that is not a serial number passes through unchanged", () => {
  check(fc.property(fc.string().filter((s) => s !== "" && !/^\d+(\.\d+)?$/.test(s)), (s) => {
    assert.equal(formatSheetDate(s), s);
  }));
});

test("a whole serial number is that many days after 1899-12-30", () => {
  check(fc.property(serialDay, (n) => {
    assert.equal(formatSheetDate(n), iso(EPOCH + n * DAY));
  }));
});

test("a number and its string form give the same date", () => {
  check(fc.property(serialDay, (n) => {
    assert.equal(formatSheetDate(n), formatSheetDate(String(n)));
  }));
});

test("consecutive serial numbers are consecutive calendar days", () => {
  check(fc.property(serialDay, (n) => {
    assert.equal(Date.parse(formatSheetDate(n + 1)) - Date.parse(formatSheetDate(n)), DAY);
  }));
});

test("the time-of-day fraction never changes the date", () => {
  check(fc.property(serialDay, fc.integer({ min: 0, max: 86_399 }), (n, secs) => {
    assert.equal(formatSheetDate(n + secs / 86_400), formatSheetDate(n));
  }));
});

test("a formatted serial is always a YYYY-MM-DD date", () => {
  check(fc.property(serialDay, (n) => {
    assert.match(formatSheetDate(n), /^\d{4}-\d{2}-\d{2}$/);
  }));
});

// ---- summarizeByCurrency ---------------------------------------------------

test("each currency's income and expenses are the sums of its own transactions", () => {
  check(fc.property(entries, (txs) => {
    const summary = summarizeByCurrency(txs);
    for (const c of CURRENCIES) {
      const own = txs.filter((t) => t.currency === c);
      const income = own.filter((t) => t.type === "income").reduce((s, t) => s + cents(t.amount), 0);
      const expenses = own.filter((t) => t.type === "expense").reduce((s, t) => s + cents(t.amount), 0);
      assert.equal(cents(summary[c]?.income ?? 0), income);
      assert.equal(cents(summary[c]?.expenses ?? 0), expenses);
    }
  }));
});

test("only currencies that appear in the data are in the summary", () => {
  check(fc.property(entries, (txs) => {
    assert.deepEqual(
      new Set(Object.keys(summarizeByCurrency(txs))),
      new Set(txs.map((t) => t.currency))
    );
  }));
});

test("transaction order does not change the summary", () => {
  check(fc.property(fc.array(entry, { maxLength: 50 }).chain((txs) => fc.tuple(fc.constant(txs), fc.shuffledSubarray(txs, { minLength: txs.length, maxLength: txs.length }))), ([txs, shuffled]) => {
    const a = summarizeByCurrency(txs);
    const b = summarizeByCurrency(shuffled);
    for (const c of CURRENCIES) {
      assert.equal(cents(a[c]?.income ?? 0), cents(b[c]?.income ?? 0));
      assert.equal(cents(a[c]?.expenses ?? 0), cents(b[c]?.expenses ?? 0));
    }
  }));
});

// ---- expenseBreakdown ------------------------------------------------------

test("breakdown amounts add up to the expenses in that currency", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const expected = txs.filter((t) => t.type === "expense" && t.currency === c).reduce((s, t) => s + cents(t.amount), 0);
    const got = expenseBreakdown(txs, c).reduce((s, r) => s + cents(r.amount), 0);
    assert.equal(got, expected);
  }));
});

test("breakdown is sorted from largest to smallest spend", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const rows = expenseBreakdown(txs, c);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].amount >= rows[i].amount);
  }));
});

test("breakdown lists each category once", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const names = expenseBreakdown(txs, c).map((r) => r.category);
    assert.equal(new Set(names).size, names.length);
  }));
});

test("breakdown percentages are within 0 to 100 and off by at most half a point per row", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const rows = expenseBreakdown(txs, c);
    for (const r of rows) assert.ok(r.percentage >= 0 && r.percentage <= 100);
    if (rows.length > 0) {
      const sum = rows.reduce((s, r) => s + r.percentage, 0);
      assert.ok(Math.abs(sum - 100) <= rows.length / 2, `sum ${sum} over ${rows.length} rows`);
    }
  }));
});

test("breakdown is empty when the currency has no expenses", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const none = txs.filter((t) => !(t.type === "expense" && t.currency === c));
    assert.deepEqual(expenseBreakdown(none, c), []);
  }));
});

test("income and other currencies never leak into the breakdown", () => {
  check(fc.property(entries, currency, (txs, c) => {
    const keep = txs.filter((t) => t.type === "expense" && t.currency === c);
    assert.deepEqual(expenseBreakdown(txs, c), expenseBreakdown(keep, c));
  }));
});

// ---- filterTransactions ----------------------------------------------------

const typeFilter = fc.constantFrom("all", "income", "expense" as const);
const categoryFilter = fc.constantFrom("all", "Food", "Shopping", "Transport", "Bills", "Other", "Travel");

test("no filter and a blank search keep every transaction in order", () => {
  check(fc.property(entries, fc.constantFrom("", " ", "   "), (txs, blank) => {
    assert.deepEqual(filterTransactions(txs, "all", "all", blank), txs);
  }));
});

test("the result is an in-order subset of the input", () => {
  check(fc.property(entries, typeFilter, categoryFilter, fc.string({ maxLength: 4 }), (txs, ty, cat, q) => {
    const out = filterTransactions(txs, ty, cat, q);
    let i = 0;
    for (const t of out) {
      while (i < txs.length && txs[i] !== t) i++;
      assert.ok(i < txs.length, "result is not an ordered subset");
      i++;
    }
  }));
});

test("the type filter keeps only that type", () => {
  check(fc.property(entries, fc.constantFrom("income", "expense" as const), (txs, ty) => {
    assert.ok(filterTransactions(txs, ty, "all", "").every((t) => t.type === ty));
  }));
});

test("the category filter keeps only that category", () => {
  check(fc.property(entries, categoryFilter.filter((c) => c !== "all"), (txs, cat) => {
    assert.ok(filterTransactions(txs, "all", cat, "").every((t) => t.category === cat));
  }));
});

test("every search hit matches in category, note or amount, ignoring case", () => {
  check(fc.property(entries, fc.string({ minLength: 1, maxLength: 3 }).filter((s) => s.trim() !== ""), (txs, q) => {
    const needle = q.toLowerCase();
    for (const t of filterTransactions(txs, "all", "all", q)) {
      assert.ok(
        t.category.toLowerCase().includes(needle) ||
          t.note.toLowerCase().includes(needle) ||
          t.amount.toString().includes(needle)
      );
    }
  }));
});

test("search never drops a transaction whose category contains the query", () => {
  check(fc.property(entries, fc.constantFrom("food", "FOOD", "Ship", "ill", "ravel"), (txs, q) => {
    const out = filterTransactions(txs, "all", "all", q);
    for (const t of txs) {
      if (t.category.toLowerCase().includes(q.toLowerCase())) assert.ok(out.includes(t));
    }
  }));
});

test("filtering twice gives the same result as once", () => {
  check(fc.property(entries, typeFilter, categoryFilter, fc.string({ maxLength: 3 }), (txs, ty, cat, q) => {
    const once = filterTransactions(txs, ty, cat, q);
    assert.deepEqual(filterTransactions(once, ty, cat, q), once);
  }));
});

// ---- formatCurrency --------------------------------------------------------

const money = fc.integer({ min: -100_000_000_000, max: 100_000_000_000 }).map((c) => c / 100);
const decimals = (s: string) => (s.includes(".") ? s.split(".")[1].replace(/\D/g, "").length : 0);

test("yen and won are shown without decimals", () => {
  check(fc.property(money, fc.constantFrom("JPY", "KRW" as const), (v, c) => {
    assert.equal(formatCurrency(v, c).includes("."), false);
  }));
});

test("every other currency is shown with at most two decimals", () => {
  const twoDp = CURRENCIES.filter((c) => c !== "JPY" && c !== "KRW");
  check(fc.property(money, fc.constantFrom(...twoDp), (v, c) => {
    assert.ok(decimals(formatCurrency(v, c)) <= 2);
  }));
});

test("the formatted amount round-trips to the value, to the displayed precision", () => {
  check(fc.property(money, currency, (v, c) => {
    const digits = c === "JPY" || c === "KRW" ? 0 : 2;
    const shown = Number(formatCurrency(v, c).replace(/[^0-9.\-]/g, "").replace(/^-?/, formatCurrency(v, c).includes("-") ? "-" : ""));
    assert.ok(Math.abs(shown - v) <= 0.5 * 10 ** -digits + 1e-9, `${v} ${c}`);
  }));
});

// ---- transactionSchema -----------------------------------------------------

const validInput = fc.record({
  date: fc.string({ minLength: 1, maxLength: 12 }),
  type: fc.constantFrom("income", "expense" as const),
  category: fc.string({ minLength: 1, maxLength: 50 }),
  amount,
  note: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
  currency,
});

test("every valid transaction is accepted and returned unchanged", () => {
  check(fc.property(validInput, (input) => {
    const parsed = transactionSchema.parse(input) as Record<string, unknown>;
    for (const k of ["date", "type", "category", "amount", "note", "currency"] as const) {
      assert.equal(parsed[k], input[k]);
    }
  }));
});

test("zero, negative and non-finite amounts are rejected", () => {
  check(fc.property(validInput, fc.oneof(fc.double({ max: 0, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity)), (input, bad) => {
    assert.equal(transactionSchema.safeParse({ ...input, amount: bad }).success, false);
  }));
});

test("amounts that are not numbers are rejected", () => {
  check(fc.property(validInput, fc.oneof(fc.string(), fc.boolean(), fc.constant(null)), (input, bad) => {
    assert.equal(transactionSchema.safeParse({ ...input, amount: bad }).success, false);
  }));
});

test("an empty or over-long category is rejected", () => {
  check(fc.property(validInput, fc.oneof(fc.constant(""), fc.string({ minLength: 51, maxLength: 80 })), (input, bad) => {
    assert.equal(transactionSchema.safeParse({ ...input, category: bad }).success, false);
  }));
});

test("an over-long note is rejected", () => {
  check(fc.property(validInput, fc.string({ minLength: 301, maxLength: 340 }), (input, note) => {
    assert.equal(transactionSchema.safeParse({ ...input, note }).success, false);
  }));
});

test("an unsupported currency or type is rejected", () => {
  const notCurrency = fc.string().filter((s) => !(CURRENCIES as readonly string[]).includes(s));
  const notType = fc.string().filter((s) => s !== "income" && s !== "expense");
  check(fc.property(validInput, notCurrency, notType, (input, c, t) => {
    assert.equal(transactionSchema.safeParse({ ...input, currency: c }).success, false);
    assert.equal(transactionSchema.safeParse({ ...input, type: t }).success, false);
  }));
});

test("unknown fields are dropped from parsed input", () => {
  check(fc.property(validInput, fc.string({ minLength: 1 }).filter((k) => !["date", "type", "category", "amount", "note", "currency", "__proto__"].includes(k)), (input, key) => {
    const parsed = transactionSchema.parse({ ...input, [key]: "x" }) as Record<string, unknown>;
    assert.equal(Object.hasOwn(parsed, key), false);
  }));
});

test("the supported currency list has no duplicates", () => {
  const list: readonly Currency[] = CURRENCIES;
  assert.equal(new Set(list).size, list.length);
});
