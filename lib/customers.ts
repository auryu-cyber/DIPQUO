import { getJsonFile, putJsonFile, deleteFile, listDir } from "@/lib/github";

/** Customer Master: simple mutable records (not period-dated like the cost masters
 *  in lib/masters.ts) stored under customers/, kept separate from masters/. */
export interface CustomerRecord {
  id: string;
  customerName: string;
  industry?: string;
  businessType?: string;
  product?: string;
  updatedAt: string;
  updatedBy: string;
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `customer-${Date.now()}`;
}

export async function listCustomers(): Promise<CustomerRecord[]> {
  const files = await listDir("customers");
  const records = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const res = await getJsonFile<CustomerRecord>(`customers/${f}`);
        return res?.data ?? null;
      })
  );
  return records
    .filter((r): r is CustomerRecord => r !== null)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export async function getCustomer(id: string) {
  return getJsonFile<CustomerRecord>(`customers/${id}.json`);
}

export interface SaveCustomerInput {
  id?: string;
  customerName: string;
  industry?: string;
  businessType?: string;
  product?: string;
}

export async function saveCustomer(input: SaveCustomerInput, authorEmail: string): Promise<void> {
  const id = input.id ?? slugify(input.customerName);
  const path = `customers/${id}.json`;
  const existing = await getJsonFile<CustomerRecord>(path);
  const data: CustomerRecord = {
    id,
    customerName: input.customerName,
    industry: input.industry,
    businessType: input.businessType,
    product: input.product,
    updatedAt: new Date().toISOString(),
    updatedBy: authorEmail,
  };
  await putJsonFile(
    path,
    data,
    `customer(${id}): ${existing ? "update" : "create"} by ${authorEmail}`,
    authorEmail,
    existing?.sha
  );
}

export async function deleteCustomer(id: string, authorEmail: string): Promise<void> {
  const path = `customers/${id}.json`;
  const existing = await getJsonFile(path);
  if (!existing) return;
  await deleteFile(path, `customer(${id}): delete by ${authorEmail}`, existing.sha);
}
