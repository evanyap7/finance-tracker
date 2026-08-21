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

export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  createdAt: string;
};

export async function getTransactions(): Promise<Transaction[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Transactions!A2:G",
  });

  return (response.data.values ?? []).map((row) => ({
    id: row[0] ?? "",
    date: row[1] ?? "",
    type: row[2] === "income" ? "income" : "expense",
    category: row[3] ?? "Other",
    amount: Number(row[4] ?? 0),
    note: row[5] ?? "",
    createdAt: row[6] ?? "",
  }));
}

export async function addTransaction(transaction: Transaction) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Transactions!A:G",
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
      ]],
    },
  });
}