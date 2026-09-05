import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addTransaction,
  getTransactions,
  softDeleteTransaction,
} from "@/lib/sheets";

const currencies = [
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

const transactionSchema = z.object({
  date: z.string().min(1),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1).max(50),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
  currency: z.enum(currencies),
});

export async function GET() {
  try {
    const transactions = await getTransactions();

    transactions.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load transactions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = transactionSchema.parse(body);

    const transaction = {
      id: crypto.randomUUID(),
      date: input.date,
      type: input.type,
      category: input.category,
      amount: input.amount,
      note: input.note ?? "",
      currency: input.currency,
      createdAt: new Date().toISOString(),
    };

    await addTransaction(transaction);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to create transaction." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (typeof id !== "string" || id.length === 0) {
      return NextResponse.json(
        { error: "A valid transaction ID is required." },
        { status: 400 }
      );
    }

    await softDeleteTransaction(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to delete transaction." },
      { status: 500 }
    );
  }
}