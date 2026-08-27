/** Shared display formatting: #,###.## everywhere a computed number is shown. */
export function formatNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(rate: number, decimals = 1): string {
  return `${formatNumber(rate * 100, decimals)}%`;
}
