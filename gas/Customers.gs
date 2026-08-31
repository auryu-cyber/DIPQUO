/** Customer Master — simple mutable records, kept in their own sheet, separate from the
 *  period-dated cost masters in Masters.gs. Read access is open to any signed-in user
 *  (needed for the Quotes list customer popup); writes are admin-only. */

function listCustomers() {
  var rows = getRows_(getSheet_(SHEETS.CUSTOMERS)).map(rowToPlain_);
  rows.sort(function (a, b) { return String(a.customerName).localeCompare(String(b.customerName)); });
  return rows;
}

/**
 * Any signed-in user may register a brand-new customer with just a name (needed so a
 * salesperson can add a new customer inline while creating a quote, regardless of their
 * 'customers' page permission). Editing an existing customer, or setting
 * industry/businessType/product on creation, requires customers='edit' (or Super Admin) —
 * that richer editing only happens from the Customers admin page.
 */
function saveCustomer(input) {
  var email = requireUser_();
  var name = String(input.customerName || '').trim();
  if (!name) throw new Error('Customer Name is required.');
  var canEdit = resolvePermission_(email, 'customers') === 'edit';

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var id = input.id || slugify_(name);
    var existing = findRow_(SHEETS.CUSTOMERS, function (r) { return r.id === id; });

    if (!canEdit) {
      if (existing) throw new Error('You do not have edit access to Customers.');
      if (input.industry || input.businessType || input.product) {
        throw new Error('You do not have edit access to Customers. You can add the customer name; someone with Customers edit access can fill in the rest later.');
      }
    }

    var row = {
      id: id,
      customerName: name,
      industry: input.industry || '',
      businessType: input.businessType || '',
      product: input.product || '',
      updatedAt: new Date().toISOString(),
      updatedBy: email
    };
    if (existing) updateRow_(SHEETS.CUSTOMERS, existing._rowIndex, row);
    else appendRow_(SHEETS.CUSTOMERS, row);
    appendActivityLog_(email, existing ? 'edited' : 'created', 'customer:' + id, (existing ? 'Saved' : 'Created') + ' customer "' + name + '"');
  } finally {
    lock.releaseLock();
  }
}

function deleteCustomer(id) {
  var email = requirePermission_('customers', 'edit');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = findRow_(SHEETS.CUSTOMERS, function (r) { return r.id === id; });
    if (!row) return;
    deleteRow_(SHEETS.CUSTOMERS, row._rowIndex);
    appendActivityLog_(email, 'edited', 'customer:' + id, 'Deleted customer');
  } finally {
    lock.releaseLock();
  }
}

function slugify_(text) {
  var slug = String(text).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || ('id-' + Date.now());
}
