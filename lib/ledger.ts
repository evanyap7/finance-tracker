import { z } from "zod";

// Pure ledger logic, kept free of googleapis and React so it can be tested alone.

export const CURRENCIES = [
  "EUR",
  "USD",
  "SGD",
  "GBP",
  "JPY",
  "AUD",
  "MYR",
  "CNY",
  "HKD",
  "KRW",
  "THB",
  "IDR",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const transactionSchema = z.object({
  date: z.string().min(1),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1).max(50),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
  currency: z.enum(CURRENCIES),
});

type LedgerEntry = {
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  currency: Currency;
};

export function formatSheetDate(value: string | number | undefined): string {
  if (value === undefined || value === "") {
    return "";
  }

  const text = String(value);

  if (!/^\d+(\.\d+)?$/.test(text)) {
    return text;
  }

  const serial = Number(text);
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);

  return date.toISOString().slice(0, 10);
}

export function summarizeByCurrency(
  transactions: Pick<LedgerEntry, "type" | "amount" | "currency">[]
): Partial<Record<Currency, { income: number; expenses: number }>> {
  return transactions.reduce<
    Partial<Record<Currency, { income: number; expenses: number }>>
  >((summary, transaction) => {
    const current = summary[transaction.currency] ?? {
      income: 0,
      expenses: 0,
    };

    if (transaction.type === "income") {
      current.income += transaction.amount;
    } else {
      current.expenses += transaction.amount;
    }

    summary[transaction.currency] = current;
    return summary;
  }, {});
}

export function expenseBreakdown(
  transactions: Pick<LedgerEntry, "type" | "amount" | "currency" | "category">[],
  currency: Currency
): { category: string; amount: number; percentage: number }[] {
  const expenses = transactions.filter(
    (t) => t.type === "expense" && t.currency === currency
  );
  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  if (total === 0) return [];

  const grouped: Record<string, number> = {};
  expenses.forEach((t) => {
    grouped[t.category] = (grouped[t.category] || 0) + t.amount;
  });

  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function filterTransactions<T extends Omit<LedgerEntry, "currency">>(
  transactions: T[],
  filterType: "all" | "income" | "expense",
  filterCategory: string,
  searchQuery: string
): T[] {
  return transactions.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesCategory = t.category.toLowerCase().includes(query);
      const matchesNote = (t.note || "").toLowerCase().includes(query);
      const matchesAmount = t.amount.toString().includes(query);
      if (!matchesCategory && !matchesNote && !matchesAmount) return false;
    }
    return true;
  });
}

export function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
  }).format(value);
}
