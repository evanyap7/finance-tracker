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

type CategoryMeta = {
  emoji: string;
  name: string;
  bg: string;
  border: string;
  text: string;
};

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  Food: { emoji: "🍰", name: "Food & Treats", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
  Shopping: { emoji: "🛍️", name: "Shopping & Hauls", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  Transport: { emoji: "🚕", name: "Transport & Rides", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  Subscriptions: { emoji: "📺", name: "Subscriptions", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  Fitness: { emoji: "🧘‍♀️", name: "Fitness & Wellness", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  Education: { emoji: "📖", name: "Books & Learning", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700" },
  Entertainment: { emoji: "🍿", name: "Entertainment & Fun", bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-700" },
  Bills: { emoji: "💌", name: "Bills & Utilities", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
  Health: { emoji: "🌸", name: "Health & Skincare", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  Travel: { emoji: "✈️", name: "Travel & Getaways", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
  Other: { emoji: "✨", name: "Other Treats", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
};

const categoryKeys = Object.keys(CATEGORY_MAP);

const currencyOptions: { code: Currency; label: string; symbol: string }[] = [
  { code: "SGD", label: "SGD — Singapore Dollar", symbol: "S$" },
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "A$" },
  { code: "MYR", label: "MYR — Malaysian Ringgit", symbol: "RM" },
  { code: "CNY", label: "CNY — Chinese Yuan", symbol: "¥" },
  { code: "HKD", label: "HKD — Hong Kong Dollar", symbol: "HK$" },
  { code: "KRW", label: "KRW — South Korean Won", symbol: "₩" },
  { code: "THB", label: "THB — Thai Baht", symbol: "฿" },
  { code: "IDR", label: "IDR — Indonesian Rupiah", symbol: "Rp" },
];

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState<Currency>("SGD");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Confirmation modal state
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "expense" as "income" | "expense",
    category: "Food",
    amount: "",
    currency: "SGD" as Currency,
    note: "",
  });

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  }

  async function loadTransactions() {
    setLoading(true);
    try {
      const response = await fetch("/api/transactions");
      const data = await response.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setTransactions([]);
      showToast("Oops! Couldn't load transactions 🥺");
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

  // Category spending breakdown for selected currency
  const categoryExpenses = useMemo(() => {
    const expenses = transactions.filter(
      (t) => t.type === "expense" && t.currency === reportingCurrency
    );
    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    if (total === 0) return [];

    const grouped: Record<string, number> = {};
    expenses.forEach((t) => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });

    return Object.entries(grouped)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percentage: Math.round((amt / total) * 100),
        meta: CATEGORY_MAP[cat] || CATEGORY_MAP.Other,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, reportingCurrency]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
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
  }, [transactions, filterType, filterCategory, searchQuery]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
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

      showToast("Saved with love into your diary! 💖 ✨");
      await loadTransactions();
    } catch {
      showToast("Could not save transaction. Please check your connection! 🥺");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTargetId) return;
    setIsArchiving(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: archiveTargetId }),
      });

      if (!response.ok) {
        throw new Error("Could not archive transaction.");
      }

      showToast("Transaction safely archived 🌸");
      await loadTransactions();
    } catch {
      showToast("Could not archive the transaction 🥺");
    } finally {
      setIsArchiving(false);
      setArchiveTargetId(null);
    }
  }

  function handleQuickAddAmount(value: number) {
    const current = Number(form.amount) || 0;
    setForm({ ...form, amount: (current + value).toFixed(2).replace(/\.00$/, "") });
  }

  function formatCurrency(value: number, currency: Currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
    }).format(value);
  }

  return (
    <main className="min-h-screen relative overflow-hidden pb-20 pt-6 px-4 sm:px-6 lg:px-8">
      {/* Decorative ambient blurred glowing orbs */}
      <div className="pointer-events-none fixed -top-24 -left-20 h-96 w-96 rounded-full bg-pink-200/50 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 -right-20 h-96 w-96 rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none fixed bottom-10 left-1/3 h-80 w-80 rounded-full bg-fuchsia-200/30 blur-3xl" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce transition duration-300">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/95 px-5 py-3.5 shadow-xl shadow-pink-500/15 border border-pink-200 text-pink-900 font-medium text-sm backdrop-blur-md">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Custom Sweet Archive Modal */}
      {archiveTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border border-pink-200 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-2xl">
              🎀
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Archive this record?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              It will be tucked away safely in your Google Sheets and hidden from your daily view!
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setArchiveTargetId(null)}
                disabled={isArchiving}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Keep it 🌸
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={isArchiving}
                className="flex-1 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-400/30 hover:opacity-95 transition"
              >
                {isArchiving ? "Archiving..." : "Yes, Archive 🗑️"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl relative z-10">
        {/* Top Announcement & Dedication Pill */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-white/70 px-4 py-1.5 text-xs sm:text-sm font-medium text-pink-800 shadow-xs backdrop-blur-md">
            <span className="animate-pulse">✨</span>
            <span>
              Made with 💖 by{" "}
              <a
                href="https://www.linkedin.com/in/evanyapzhikai/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-pink-600 underline decoration-pink-300 underline-offset-2 transition hover:text-pink-700 hover:decoration-pink-500"
              >
                Evan
              </a>{" "}
              especially for <strong className="font-semibold text-pink-600">Clara Heng Jia Ee</strong>
            </span>
            <span>🎀</span>
          </div>
        </div>

        {/* Header section */}
        <header className="mb-8 rounded-3xl glass-panel p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-pink-100/50 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-pink-500 font-semibold text-sm tracking-wider uppercase mb-1">
                <span className="inline-block animate-gentle-float">🌸</span>
                <span>Personal Finance Diary</span>
                <span className="inline-block animate-gentle-float">✨</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent">
                Clara&apos;s Money Diary 🎀
              </h1>
              <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-xl">
                Track sweet moments, mindful spending, and watch your savings bloom! 🌷✨
              </p>
            </div>

            {/* Currency Selector Pill */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-pink-50/60 p-2.5 sm:p-3 rounded-2xl border border-pink-100 self-start md:self-auto">
              <span className="text-xs font-semibold text-pink-700 uppercase tracking-wider pl-1">
                👛 Summary Currency:
              </span>
              <select
                value={reportingCurrency}
                onChange={(event) =>
                  setReportingCurrency(event.target.value as Currency)
                }
                className="rounded-xl border border-pink-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-pink-900 shadow-xs outline-none focus:ring-2 focus:ring-pink-400 cursor-pointer"
              >
                {currencyOptions.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Hero Summary Cards */}
        <section className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Net Cash Flow Card */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-pink-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Net Cash Flow
              </span>
              <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-600">
                {netCashFlow >= 0 ? "🌸 Saving Queen" : "👛 Spending Era"}
              </span>
            </div>
            <p
              className={`mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight ${
                netCashFlow >= 0 ? "text-rose-500" : "text-slate-700"
              }`}
            >
              {formatCurrency(netCashFlow, reportingCurrency)}
            </p>
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              <span>{netCashFlow >= 0 ? "✨ Your purse is glowing today!" : "🌷 Be gentle with your wallet!"}</span>
            </p>
          </div>

          {/* Income Card */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-pink-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Inflow
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-sm border border-emerald-200">
                💖
              </span>
            </div>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-600">
              {formatCurrency(selectedSummary.income, reportingCurrency)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Sweet money deposited into your account 💸
            </p>
          </div>

          {/* Expenses Card */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden border border-pink-100 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Expenses
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-sm border border-rose-200">
                🛍️
              </span>
            </div>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-rose-500">
              {formatCurrency(selectedSummary.expenses, reportingCurrency)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Treats, essentials, and good memories 🍰
            </p>
          </div>
        </section>

        {/* Category Expense Breakdown (Visual Spending Bar) */}
        {categoryExpenses.length > 0 && (
          <section className="mb-8 rounded-3xl glass-panel p-6 border border-pink-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎀</span>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  Spending by Category ({reportingCurrency})
                </h2>
              </div>
              <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-200">
                {categoryExpenses.length} Categories
              </span>
            </div>

            {/* Segmented colored progress bar */}
            <div className="h-4 w-full overflow-hidden rounded-full bg-pink-100/60 flex shadow-inner mb-4">
              {categoryExpenses.map((cat, idx) => {
                const colors = [
                  "bg-pink-500",
                  "bg-rose-400",
                  "bg-fuchsia-400",
                  "bg-purple-400",
                  "bg-amber-400",
                  "bg-teal-400",
                  "bg-sky-400",
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={cat.category}
                    style={{ width: `${cat.percentage}%` }}
                    className={`${color} transition-all duration-500`}
                    title={`${cat.category}: ${formatCurrency(cat.amount, reportingCurrency)} (${cat.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Category pills list */}
            <div className="flex flex-wrap gap-2 pt-1">
              {categoryExpenses.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center gap-1.5 rounded-xl border border-pink-100 bg-white/80 px-3 py-1 text-xs text-slate-700 shadow-xs"
                >
                  <span>{cat.meta.emoji}</span>
                  <span className="font-semibold">{cat.category}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-pink-600">
                    {formatCurrency(cat.amount, reportingCurrency)}
                  </span>
                  <span className="rounded-md bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold text-pink-600">
                    {cat.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other currencies breakdown */}
        {Object.entries(summaryByCurrency).some(
          ([currency]) => currency !== reportingCurrency
        ) && (
          <section className="mb-8 rounded-3xl glass-panel p-6 border border-pink-100">
            <h2 className="mb-3 text-base font-bold text-slate-800 flex items-center gap-2">
              <span>✈️</span> Other Currencies
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(summaryByCurrency)
                .filter(([currency]) => currency !== reportingCurrency)
                .map(([currency, values]) => {
                  const currencyCode = currency as Currency;
                  const net = values.income - values.expenses;

                  return (
                    <div
                      key={currency}
                      className="rounded-2xl border border-pink-100 bg-white/70 p-4 transition hover:bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          {currency}
                        </span>
                        <span className="text-xs font-semibold text-pink-600">
                          {net >= 0 ? "✨ In surplus" : "👛 Outflow"}
                        </span>
                      </div>
                      <p
                        className={`mt-2 text-xl font-extrabold ${
                          net >= 0 ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {formatCurrency(net, currencyCode)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        In {formatCurrency(values.income, currencyCode)} · Out{" "}
                        {formatCurrency(values.expenses, currencyCode)}
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Form and Transaction List Grid */}
        <section className="grid gap-8 lg:grid-cols-[400px_1fr] items-start">
          {/* Add Transaction Card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl glass-panel p-6 shadow-sm border border-pink-200 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-base">
                  📝
                </span>
                <h2 className="text-lg font-bold text-slate-800">
                  New Entry
                </h2>
              </div>
              <span className="text-xs text-pink-600 font-semibold bg-pink-50 px-2.5 py-1 rounded-full border border-pink-100">
                Log Spending 🌸
              </span>
            </div>

            <div className="space-y-4">
              {/* Type Switcher: Segmented cute toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Entry Type
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-pink-100/60 p-1.5 border border-pink-200">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "expense" })}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                      form.type === "expense"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-300/40"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>💸</span> Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "income" })}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                      form.type === "income"
                        ? "bg-pink-500 text-white shadow-md shadow-pink-300/40"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>💖</span> Income
                  </button>
                </div>
              </div>

              {/* Date & Currency row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Date
                  </span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                    className="cute-input"
                    required
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Currency
                  </span>
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        currency: event.target.value as Currency,
                      })
                    }
                    className="cute-input font-medium"
                  >
                    {currencyOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Category */}
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Category
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className="cute-input font-medium"
                >
                  {categoryKeys.map((catKey) => {
                    const meta = CATEGORY_MAP[catKey];
                    return (
                      <option key={catKey} value={catKey}>
                        {meta.emoji} {meta.name}
                      </option>
                    );
                  })}
                </select>
              </label>

              {/* Amount with Quick Add buttons */}
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Amount
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    placeholder="0.00"
                    className="cute-input pl-10 text-lg font-bold text-slate-800"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-semibold">
                    {currencyOptions.find((c) => c.code === form.currency)?.symbol || "$"}
                  </div>
                </div>

                {/* Quick Add Amount Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAddAmount(amt)}
                      className="rounded-lg border border-pink-200 bg-pink-50/70 px-2.5 py-1 text-xs font-semibold text-pink-700 transition hover:bg-pink-100 active:scale-95"
                    >
                      +{amt}
                    </button>
                  ))}
                  {form.amount && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, amount: "" })}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Note */}
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Sweet Note (Optional)
                </span>
                <input
                  type="text"
                  maxLength={300}
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                  placeholder="e.g. Strawberry latte with friends 🍓"
                  className="cute-input text-sm"
                />
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-pink-300/40 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{submitting ? "Saving to diary..." : "Add to Diary ✨"}</span>
                {!submitting && <span>🎀</span>}
              </button>
            </div>
          </form>

          {/* Transactions List with Filters & Search */}
          <section className="rounded-3xl glass-panel p-6 shadow-sm border border-pink-200">
            {/* Section Header */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">👛</span>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">
                    Diary Entries
                  </h2>
                  <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
                    {filteredTransactions.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and organize your recent records
                </p>
              </div>

              <button
                type="button"
                onClick={loadTransactions}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-pink-200 bg-white px-3 py-1.5 text-xs font-bold text-pink-600 hover:bg-pink-50 transition active:scale-95 shadow-2xs"
              >
                <span>✨</span>
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="mb-5 flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search note, category, or amount... 🔍"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="cute-input text-xs sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Type Filter Buttons */}
              <div className="flex gap-1 rounded-xl bg-pink-100/60 p-1 border border-pink-200 self-start sm:self-auto">
                {(["all", "expense", "income"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition ${
                      filterType === type
                        ? "bg-white text-pink-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {type === "all" ? "All" : type === "expense" ? "💸 Out" : "💖 In"}
                  </button>
                ))}
              </div>

              {/* Category Filter Dropdown */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl border border-pink-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">All Categories 🌸</option>
                {categoryKeys.map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {CATEGORY_MAP[catKey].emoji} {catKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Content states */}
            {loading ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-2xl animate-spin">
                  🌸
                </div>
                <p className="text-sm font-semibold text-pink-700">
                  Opening your money diary...
                </p>
                <p className="text-xs text-slate-400 mt-1">Just a sparkling second ✨</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-pink-200/80 bg-pink-50/30 p-12 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pink-100/80 text-3xl">
                  🫧
                </div>
                <h3 className="text-base font-bold text-slate-700">
                  {transactions.length === 0
                    ? "No transactions yet, darling!"
                    : "No matching entries found!"}
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                  {transactions.length === 0
                    ? "Log your first coffee, shopping spree, or treat above to start tracking ✨"
                    : "Try clearing your search query or selecting another filter pill 🌸"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {filteredTransactions.map((transaction) => {
                  const meta =
                    CATEGORY_MAP[transaction.category] || CATEGORY_MAP.Other;
                  const isIncome = transaction.type === "income";

                  return (
                    <article
                      key={transaction.id}
                      className="group flex items-center justify-between rounded-2xl border border-pink-100/90 bg-white/80 p-4 transition-all hover:bg-white hover:border-pink-300 hover:shadow-md hover:shadow-pink-500/5"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Category Avatar */}
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.border} border text-xl shadow-2xs`}
                        >
                          {meta.emoji}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 truncate text-sm">
                              {transaction.category}
                            </p>
                            <span
                              className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                                isIncome
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  : "bg-rose-50 text-rose-600 border border-rose-200"
                              }`}
                            >
                              {isIncome ? "Income" : "Expense"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="font-medium">{transaction.date}</span>
                            {transaction.note && (
                              <span> · {transaction.note}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right Amount & Archive Action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p
                            className={`font-extrabold text-sm sm:text-base ${
                              isIncome ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400">
                            {transaction.currency}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setArchiveTargetId(transaction.id)}
                          className="rounded-xl p-2 text-xs font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Archive transaction"
                          aria-label={`Archive ${transaction.category} transaction`}
                        >
                          🗑️
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        {/* Footer with dedication */}
        <footer className="mt-16 text-center border-t border-pink-100 pt-8 pb-4">
          <div className="inline-flex flex-col sm:flex-row items-center gap-2 rounded-2xl bg-white/60 px-6 py-3 border border-pink-200/60 shadow-xs backdrop-blur-md">
            <span className="text-sm">🌸</span>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Made with 💖 by{" "}
              <a
                href="https://www.linkedin.com/in/evanyapzhikai/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-pink-600 underline decoration-pink-300 underline-offset-2 hover:text-pink-700 transition"
              >
                Evan
              </a>{" "}
              especially for{" "}
              <span className="font-bold text-pink-600">
                Clara Heng Jia Ee
              </span>
            </p>
            <span className="text-sm">🎀</span>
          </div>
          <p className="mt-3 text-xs text-pink-400/80">
            Keep shining, saving & budgeting with joy ✨
          </p>
        </footer>
      </div>
    </main>
  );
}