// Money helpers: app stores everything in PAISE (integer). Display in INR.
export const paiseToRupees = (paise: number | bigint | null | undefined): number => {
  if (paise == null) return 0;
  const n = typeof paise === "bigint" ? Number(paise) : paise;
  return n / 100;
};

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const formatINR = (paise: number | bigint | null | undefined, opts?: { withSymbol?: boolean }): string => {
  const v = paiseToRupees(paise);
  const fmt = new Intl.NumberFormat("en-IN", {
    style: opts?.withSymbol === false ? "decimal" : "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return fmt.format(v);
};

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

export const formatAccountNumber = (n: string): string =>
  n.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
