/**
 * Cost calculation engine — a line-for-line port of lib/calc.ts (Next.js version).
 * Kept as plain, dependency-free functions so ClientCalc.html can duplicate the exact same
 * logic for instant, no-round-trip live recalculation while the user is typing.
 */

function materialCostPerPc(material) {
  var totalLoss = material.lossRate.setting + material.lossRate.moulding + material.lossRate.cutting + material.lossRate.inspection;
  return (material.pricePerKg / 1000) * material.weightG * (1 + totalLoss);
}

function processCostPerPc_(hourlyChargeTHB, process) {
  var qtyPerHourAfterLoss;
  if (process.cycleTimeMin !== undefined && process.cycleTimeMin !== null) {
    var qtyPerHour = (process.qtyPerShot * 60) / process.cycleTimeMin;
    qtyPerHourAfterLoss = qtyPerHour * process.machines * (1 - process.lossRate);
  } else if (process.qtyPerHour !== undefined && process.qtyPerHour !== null) {
    qtyPerHourAfterLoss = process.qtyPerHour * (1 - process.lossRate);
  } else {
    var qph = 3600 / process.secPerPc;
    qtyPerHourAfterLoss = qph * (1 - process.lossRate);
  }
  if (qtyPerHourAfterLoss <= 0) return 0;
  return hourlyChargeTHB / qtyPerHourAfterLoss;
}

function laborCostPerPc(labor) {
  return labor.processes.reduce(function (sum, p) { return sum + processCostPerPc_(labor.hourlyChargeTHB, p); }, 0);
}

/** Same total as laborCostPerPc, broken out per process for display. */
function laborCostByProcess(labor) {
  return labor.processes.map(function (p) {
    return { name: p.name, costPerPc: round_(processCostPerPc_(labor.hourlyChargeTHB, p)) };
  });
}

function packingItemCostPerPc(item) {
  if (item.qtyPerUnit <= 0) return 0;
  return item.priceTHB / item.qtyPerUnit;
}

function packingCostPerPc(packing) {
  return packing.items.reduce(function (sum, item) { return sum + packingItemCostPerPc(item); }, 0);
}

function transportationCostPerPc(transportation) {
  if (transportation.qtyPerTrip <= 0) return 0;
  return (transportation.vehicleTHB + transportation.fuelTHB) / transportation.qtyPerTrip;
}

function toolingTotals(tooling) {
  var totalTHB = tooling.items.reduce(function (sum, item) {
    if (typeof item.totalTHB === 'number') return sum + item.totalTHB;
    if (typeof item.qty === 'number' && typeof item.unitPriceTHB === 'number') return sum + item.qty * item.unitPriceTHB;
    return sum;
  }, 0);
  return { totalTHB: totalTHB, customerPriceTHB: totalTHB * tooling.customerMarkup };
}

/** Labor loss rates for these three processes are not entered directly — they're derived
 *  live from the Material Cost loss-rate breakdown. Packing keeps its own editable rate. */
function deriveProcessLossRate(processName, material) {
  var n = String(processName).toLowerCase();
  if (n.indexOf('dipping') !== -1) return 1 - (1 - material.lossRate.setting) * (1 - material.lossRate.moulding);
  if (n.indexOf('cutting') !== -1) return material.lossRate.cutting;
  if (n.indexOf('inspection') !== -1) return material.lossRate.inspection;
  return null;
}

function withDerivedLossRates(labor, material) {
  return {
    hourlyChargeTHB: labor.hourlyChargeTHB,
    processes: labor.processes.map(function (p) {
      var derived = deriveProcessLossRate(p.name, material);
      if (derived === null) return p;
      var copy = {};
      Object.keys(p).forEach(function (k) { copy[k] = p[k]; });
      copy.lossRate = derived;
      return copy;
    })
  };
}

/**
 * Rolls every cost section up into the summary shown on the quote form.
 * `quote.labor` is expected to already have derived loss rates applied (see
 * withDerivedLossRates) — callers are responsible for that, matching the Next.js version
 * where the form always saves/calculates against the derived labor snapshot.
 */
function calculateSummary(quote) {
  var material = materialCostPerPc(quote.material);
  var labor = laborCostPerPc(quote.labor);
  var packing = packingCostPerPc(quote.packing);
  var transportation = transportationCostPerPc(quote.transportation);

  var cogs = material + labor + packing + transportation;
  var overhead = cogs * quote.overheadRate;
  var profit = cogs * quote.profitRate;
  var totalPrice = cogs + overhead + profit;

  var hasOverride = quote.finalPriceOverride !== undefined && quote.finalPriceOverride !== null && quote.finalPriceOverride !== '';
  var finalPriceToCustomer = hasOverride ? Number(quote.finalPriceOverride) : totalPrice;

  return {
    materialCostPerPc: round_(material),
    laborCostPerPc: round_(labor),
    packingCostPerPc: round_(packing),
    transportationCostPerPc: round_(transportation),
    cogs: round_(cogs),
    overhead: round_(overhead),
    profit: round_(profit),
    totalPrice: round_(totalPrice),
    materialPct: finalPriceToCustomer > 0 ? round_(material / finalPriceToCustomer, 4) : 0,
    grossMarginPct: finalPriceToCustomer > 0 ? round_((finalPriceToCustomer - cogs) / finalPriceToCustomer, 4) : 0,
    finalPriceToCustomer: round_(finalPriceToCustomer)
  };
}

function round_(n, decimals) {
  if (decimals === undefined) decimals = 3;
  var factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function formatNumber_(n, decimals) {
  if (decimals === undefined) decimals = 2;
  n = Number(n);
  if (!isFinite(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
