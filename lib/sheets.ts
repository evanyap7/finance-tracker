import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!spreadsheetId || !clientEmail || !privateKey) {
  throw new Error("Missing Google Sheets environment variables.");
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

export type Currency =
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

export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  createdAt: string;
  currency: Currency;
  deletedAt: string;
};

type StoredTransaction = Transaction & {
  rowNumber: number;
};

function formatSheetDate(value: string | number | undefined): string {
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

async function getStoredTransactions(): Promise<StoredTransaction[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Transactions!A2:I",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  return (response.data.values ?? []).map((row, index) => ({
    id: row[0] ?? "",
    date: formatSheetDate(row[1]),
    type: row[2] === "income" ? "income" : "expense",
    category: row[3] ?? "Other",
    amount: Number(row[4] ?? 0),
    note: row[5] ?? "",
    createdAt: row[6] ?? "",
    currency: (row[7] || "USD") as Currency,
    deletedAt: row[8] ?? "",
    rowNumber: index + 2,
  }));
}

export async function getTransactions(): Promise<Transaction[]> {
  const transactions = await getStoredTransactions();

  return transactions
    .filter((transaction) => !transaction.deletedAt)
    .map(({ rowNumber, ...transaction }) => transaction);
}

export async function addTransaction(
  transaction: Omit<Transaction, "deletedAt">
) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Transactions!A:I",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        transaction.id,
        transaction.date,
        transaction.type,
        transaction.category,
        transaction.amount,
        transaction.note,
        transaction.createdAt,
        transaction.currency,
        "",
      ]],
    },
  });
}

export async function softDeleteTransaction(id: string) {
  const transactions = await getStoredTransactions();

  const transaction = transactions.find(
    (item) => item.id === id && !item.deletedAt
  );

  if (!transaction) {
    throw new Error("Transaction not found or already archived.");
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Transactions!I${transaction.rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString()]],
    },
  });
}