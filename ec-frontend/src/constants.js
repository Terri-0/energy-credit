export const MINT_RATE = 0.0007; // 0.7 EC per kWh — 30% below grid parity to incentivise marketplace
export const MINT_FEE = 0.06;   // 6% burned to platform reserve
export const GRID_PRICE_CAD = 0.1; // $0.10 CAD per kWh = $0.10 CAD per EC

export function apiError(err) {
  const status = err.response?.status;
  if (status === 402) return "Insufficient EC balance";
  if (status === 403) return "You don't have permission to do this";
  if (status === 500) return "Something went wrong — please try again";
  return err.response?.data?.error || "Something went wrong — please try again";
}

// Shows Wh with kWh in parentheses for context: "1,234 Wh (1.23 kWh)"
export function fmtWh(wh) {
  return `${wh.toLocaleString()} Wh (${(wh / 1000).toFixed(2)} kWh)`;
}

// Savings in CAD from Wh at grid rate (per kWh)
export function whToCAD(wh) {
  return (wh / 1000) * GRID_PRICE_CAD;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
