/** Quotes — one row per quote in the Quotes sheet. Flattened columns mirror the Next.js
 *  version's index.json (for the list view); the full quote object lives in `dataJson`
 *  (mirroring quotes/{id}/{variant}.json). */

function listQuotes() {
  requirePermission_('quotes', 'view');
  return getRows_(getSheet_(SHEETS.QUOTES)).filter(function (r) { return !r.deletedAt; }).map(function (r) {
    return {
      id: r.id,
      variant: r.variant,
      productName: r.productName,
      customerName: r.customerName,
      inquiryDate: r.inquiryDate,
      material: r.material,
      monthlyQty: Number(r.monthlyQty) || 0,
      finalPriceToCustomer: Number(r.finalPriceToCustomer) || 0,
      grossMarginPct: Number(r.grossMarginPct) || 0,
      status: r.status,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy
    };
  });
}

function getQuote(id, variant) {
  requirePermission_('quotes', 'view');
  var row = findRow_(SHEETS.QUOTES, function (r) { return r.id === id && r.variant === variant; });
  if (!row || row.deletedAt) return null;
  return JSON.parse(row.dataJson);
}

/** Soft-delete: marks the row as deleted (hidden from listQuotes/getQuote) instead of
 *  removing it, so the data stays in the spreadsheet for recovery/audit. */
function softDeleteQuotes(idVariantPairs) {
  var email = requirePermission_('quotes', 'edit');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var deleted = [];
  try {
    idVariantPairs.forEach(function (pair) {
      var parts = String(pair).split('/');
      var id = parts[0], variant = parts[1];
      if (!id || !variant) return;
      var row = findRow_(SHEETS.QUOTES, function (r) { return r.id === id && r.variant === variant; });
      if (!row || row.deletedAt) return;
      var updated = shallowCopy_(row);
      updated.deletedAt = new Date().toISOString();
      updateRow_(SHEETS.QUOTES, row._rowIndex, updated);
      deleted.push(id + '/' + variant);
    });
    if (deleted.length > 0) {
      appendActivityLog_(email, 'edited', deleted.join(', '), 'Deleted (hidden) ' + deleted.length + ' quote(s) — data preserved in the spreadsheet');
    }
  } finally {
    lock.releaseLock();
  }
  return deleted;
}

/**
 * Recomputes the summary, writes the row, and — if renameFrom is given and differs from
 * the quote's own id/variant — removes the old row (equivalent of the GitHub version's
 * "rename moves the file" behavior for an id/variant change).
 */
function saveQuote(quote, renameFrom) {
  var email = requirePermission_('quotes', 'edit');

  if (!quote.productName || !String(quote.productName).trim()) {
    throw new Error('Product Name is required.');
  }
  if (!quote.variant || !String(quote.variant).trim()) {
    throw new Error('Variant is required.');
  }
  if (!quote.customerName || !String(quote.customerName).trim() || !quote.projectName || !String(quote.projectName).trim()) {
    throw new Error('Customer Name and Project Name are required.');
  }
  if (quote.projectType === 'other' && (!quote.projectTypeOther || !String(quote.projectTypeOther).trim())) {
    throw new Error('Please describe the project type when "Other" is selected.');
  }
  if (!quote.massProductionStart || !quote.massProductionStart.year) {
    throw new Error('Mass Production Start Year is required.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    quote.id = (quote.id && String(quote.id).trim()) || slugify_(quote.productName);
    quote.labor = withDerivedLossRates(quote.labor, quote.material);
    quote.calculated = calculateSummary(quote);
    quote.updatedAt = new Date().toISOString();
    quote.updatedBy = email;

    var sourceId = renameFrom ? renameFrom.id : quote.id;
    var sourceVariant = renameFrom ? renameFrom.variant : quote.variant;
    var oldQuote = getQuote(sourceId, sourceVariant);

    var existingRow = findRow_(SHEETS.QUOTES, function (r) { return r.id === quote.id && r.variant === quote.variant; });
    if (existingRow) {
      updateRow_(SHEETS.QUOTES, existingRow._rowIndex, quoteToRow_(quote));
    } else {
      appendRow_(SHEETS.QUOTES, quoteToRow_(quote));
    }

    var isRename = renameFrom && (renameFrom.id !== quote.id || renameFrom.variant !== quote.variant);
    if (isRename) {
      var oldRow = findRow_(SHEETS.QUOTES, function (r) { return r.id === renameFrom.id && r.variant === renameFrom.variant; });
      if (oldRow) deleteRow_(SHEETS.QUOTES, oldRow._rowIndex);
    }

    var changes = diffQuoteFields_(oldQuote, quote);
    appendActivityLog_(
      email,
      existingRow ? 'edited' : 'created',
      quote.id + '/' + quote.variant,
      changes.length > 0 ? changes.join('; ') : (existingRow ? 'No field changes' : 'Created')
    );

    return quote;
  } finally {
    lock.releaseLock();
  }
}

/** Duplicates each selected quote as a new draft (unique variant), leaving the originals
 *  untouched. Mirrors the Next.js "Duplicate Selected" bulk action. */
function duplicateQuotes(idVariantPairs) {
  var email = requirePermission_('quotes', 'edit');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var created = [];
  try {
    idVariantPairs.forEach(function (pair, i) {
      var parts = String(pair).split('/');
      var id = parts[0], variant = parts[1];
      if (!id || !variant) return;
      var existing = getQuote(id, variant);
      if (!existing) return;

      var copy = JSON.parse(JSON.stringify(existing));
      copy.variant = variant + '-copy-' + Date.now().toString(36) + i;
      copy.status = 'draft';
      copy.calculated = calculateSummary(copy);
      copy.updatedAt = new Date().toISOString();
      copy.updatedBy = email;
      appendRow_(SHEETS.QUOTES, quoteToRow_(copy));
      created.push({ id: copy.id, variant: copy.variant });
    });

    if (created.length > 0) {
      appendActivityLog_(
        email,
        'created',
        created.map(function (c) { return c.id + '/' + c.variant; }).join(', '),
        'Duplicated ' + created.length + ' quote(s) from selection'
      );
    }
  } finally {
    lock.releaseLock();
  }
  return created;
}

function quoteToRow_(quote) {
  return {
    id: quote.id,
    variant: quote.variant,
    productName: quote.productName,
    customerName: quote.customerName,
    inquiryDate: quote.inquiryDate,
    material: quote.material.name,
    monthlyQty: quote.monthlyQty,
    finalPriceToCustomer: quote.calculated.finalPriceToCustomer,
    grossMarginPct: quote.calculated.grossMarginPct,
    status: quote.status,
    updatedAt: quote.updatedAt,
    updatedBy: quote.updatedBy,
    dataJson: JSON.stringify(quote)
  };
}

/** "Label: old → new" for every field that actually changed, for the Activity Log. */
function diffQuoteFields_(oldQ, newQ) {
  if (!oldQ) return [];
  var changes = [];
  function text(label, a, b) {
    if (a !== b) changes.push(label + ': ' + (a === undefined || a === null || a === '' ? '-' : a) + ' → ' + (b === undefined || b === null || b === '' ? '-' : b));
  }
  function num(label, a, b, decimals) {
    a = Number(a); b = Number(b);
    if (a !== b) changes.push(label + ': ' + formatNumber_(a, decimals) + ' → ' + formatNumber_(b, decimals));
  }
  text('Product Name', oldQ.productName, newQ.productName);
  text('Customer Name', oldQ.customerName, newQ.customerName);
  text('Project Name', oldQ.projectName, newQ.projectName);
  text('Status', oldQ.status, newQ.status);
  text('Order Status', oldQ.orderStatus, newQ.orderStatus);
  num('Monthly Qty', oldQ.monthlyQty, newQ.monthlyQty, 0);
  num('Material Price (THB/kg)', oldQ.material.pricePerKg, newQ.material.pricePerKg, 2);
  num('Weight (g/pc)', oldQ.material.weightG, newQ.material.weightG, 3);
  num('Hourly Charge (THB/h)', oldQ.labor.hourlyChargeTHB, newQ.labor.hourlyChargeTHB, 2);
  num('Tooling Customer Markup', oldQ.tooling.customerMarkup, newQ.tooling.customerMarkup, 3);
  num('Overhead Rate', oldQ.overheadRate * 100, newQ.overheadRate * 100, 1);
  num('Profit Rate', oldQ.profitRate * 100, newQ.profitRate * 100, 1);
  num('Final Price to Customer', oldQ.calculated.finalPriceToCustomer, newQ.calculated.finalPriceToCustomer, 3);
  text('Pricing Date', oldQ.pricingDate, newQ.pricingDate);
  return changes;
}
