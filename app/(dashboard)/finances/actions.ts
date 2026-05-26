"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function addExpense(values: {
  date: string;
  category: string;
  amount: number;
  description: string | null;
}) {
  const supabase = await createClient();

  if (!values.date || !values.category || !(values.amount > 0)) {
    return { ok: false as const, error: "Date, catégorie et montant sont requis." };
  }

  const { error } = await supabase.from("expenses").insert({
    date: values.date,
    category: values.category,
    amount: Math.round(values.amount),
    description: values.description,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/finances");
  revalidatePath("/");
  return { ok: true as const, error: null };
}
