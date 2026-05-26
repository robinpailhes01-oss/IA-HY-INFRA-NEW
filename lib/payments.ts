export type PaymentMethod = "cb" | "especes" | "virement" | "cheque";

export type BalancePayment = { method: string; amount: number };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cb", label: "Carte (SumUp)" },
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
];

export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

export function paymentLabel(method: string | null): string {
  return PAYMENT_LABEL[method ?? ""] ?? method ?? "—";
}

export function parsePayments(value: unknown): BalancePayment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (p): p is BalancePayment =>
        !!p && typeof p === "object" && "amount" in p && "method" in p,
    )
    .map((p) => ({ method: String(p.method), amount: Number(p.amount) || 0 }));
}
