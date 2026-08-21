"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  createdAt: string;
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
  "Other",
];

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Food",
    amount: "",
    note: "",
  });

  async function loadTransactions() {
    setLoading(true);

    const response = await fetch("/api/transactions");
    const data = await response.json();

    setTransactions(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const summary = useMemo(() => {
    const income = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expenses = transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }, [transactions]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

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

    if (response.ok) {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "expense",
        category: "Food",
        amount: "",
        note: "",
      });

      await loadTransactions();
    } else {
      alert("Could not save the transaction. Check your setup.");
    }

    setSubmitting(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
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
          <p className="mt-2 text-slate-600">
            Track income and expenses in your private Google Sheet.
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <SummaryCard label="Balance" value={summary.balance} />
          <SummaryCard label="Income" value={summary.income} positive />
          <SummaryCard label="Expenses" value={summary.expenses} negative />
        </section>

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

              <Field label="Amount (SGD)">
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
                No entries yet. Add your first transaction.
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

                    <p
                      className={
                        transaction.type === "income"
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-rose-600"
                      }
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </p>
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
  positive,
  negative,
}: {
  label: string;
  value: number;
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
        {new Intl.NumberFormat("en-SG", {
          style: "currency",
          currency: "SGD",
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