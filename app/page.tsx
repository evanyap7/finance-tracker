"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Currency =
  | "SGD"
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "AUD"
  | "MYR"
  | "CNY"
  | "HKD"
  | "KRW"
  | "THB"
  | "IDR";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  createdAt: string;
  currency: Currency;
};

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Subscriptions",
  "Fitness",
  "Education",
  "Entertainment",
  "Bills",
  "Health",
  "Travel",
  "Other",
];

const currencyOptions: { code: Currency; label: string }[] = [
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "KRW", label: "KRW — South Korean Won" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "IDR", label: "IDR — Indonesian Rupiah" },
];

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportingCurrency, setReportingCurrency] =
    useState<Currency>("USD");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "expense" as "income" | "expense",
    category: "Food",
    amount: "",
    currency: "USD" as Currency,
    note: "",
  });

  async function loadTransactions() {
    setLoading(true);

    try {
      const response = await fetch("/api/transactions");
      const data = await response.json();

      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const summaryByCurrency = useMemo(() => {
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
  }, [transactions]);

  const selectedSummary = summaryByCurrency[reportingCurrency] ?? {
    income: 0,
    expenses: 0,
  };

  const netCashFlow = selectedSummary.income - selectedSummary.expenses;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });

      if (!response.ok) {
        throw new Error("Could not save transaction.");
      }

      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "expense",
        category: "Food",
        amount: "",
        currency: form.currency,
        note: "",
      });

      await loadTransactions();
    } catch {
      alert("Could not save the transaction. Check your setup.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    const shouldArchive = window.confirm(
      "Archive this transaction? It will remain in Google Sheets and can be restored later."
    );

    if (!shouldArchive) return;

    try {
      const response = await fetch("/api/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Could not archive transaction.");
      }

      await loadTransactions();
    } catch {
      alert("Could not archive the transaction.");
    }
  }

  function formatCurrency(value: number, currency: Currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
    }).format(value);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-medium text-indigo-600">
            Personal Finance
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Finance tracker
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-slate-600">
              Track income, expenses, and net cash flow across currencies.
            </p>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Summary currency
              <select
                value={reportingCurrency}
                onChange={(event) =>
                  setReportingCurrency(event.target.value as Currency)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500"
              >
                {currencyOptions.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Net cash flow"
            value={netCashFlow}
            currency={reportingCurrency}
            positive={netCashFlow >= 0}
            negative={netCashFlow < 0}
          />

          <SummaryCard
            label="Income"
            value={selectedSummary.income}
            currency={reportingCurrency}
            positive
          />

          <SummaryCard
            label="Expenses"
            value={selectedSummary.expenses}
            currency={reportingCurrency}
            negative
          />
        </section>

        {Object.entries(summaryByCurrency).some(
          ([currency]) => currency !== reportingCurrency
        ) && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Other currencies</h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(summaryByCurrency)
                .filter(([currency]) => currency !== reportingCurrency)
                .map(([currency, values]) => {
                  const currencyCode = currency as Currency;
                  const net = values.income - values.expenses;

                  return (
                    <div
                      key={currency}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <p className="text-sm font-medium text-slate-500">
                        {currency}
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Net cash flow
                      </p>

                      <p
                        className={`mt-1 text-xl font-bold ${
                          net >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(net, currencyCode)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        In {formatCurrency(values.income, currencyCode)}
                        {" · "}
                        Out {formatCurrency(values.expenses, currencyCode)}
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        <section className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-2xl bg-white p-6 shadow-sm"
          >
            <h2 className="mb-5 text-xl font-semibold">Add transaction</h2>

            <div className="space-y-4">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                  className="input"
                  required
                />
              </Field>

              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value as "income" | "expense",
                    })
                  }
                  className="input"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </Field>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className="input"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      currency: event.target.value as Currency,
                    })
                  }
                  className="input"
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="12.50"
                  className="input"
                  required
                />
              </Field>

              <Field label="Note">
                <input
                  type="text"
                  maxLength={300}
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                  placeholder="e.g. Dinner with friends"
                  className="input"
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save transaction"}
              </button>
            </div>
          </form>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent transactions</h2>

              <button
                type="button"
                onClick={loadTransactions}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-slate-500">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-slate-500">
                No active transactions. Archived items remain in Google Sheets.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <article
                    key={transaction.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                  >
                    <div>
                      <p className="font-medium">{transaction.category}</p>
                      <p className="text-sm text-slate-500">
                        {transaction.date}
                        {transaction.note ? ` · ${transaction.note}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p
                        className={
                          transaction.type === "income"
                            ? "font-semibold text-emerald-600"
                            : "font-semibold text-rose-600"
                        }
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleArchive(transaction.id)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                        aria-label={`Archive ${transaction.category} transaction`}
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  currency,
  positive,
  negative,
}: {
  label: string;
  value: number;
  currency: Currency;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive
    ? "text-emerald-600"
    : negative
      ? "text-rose-600"
      : "text-slate-900";

  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className={`mt-2 text-3xl font-bold ${color}`}>
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
        }).format(value)}
      </p>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}