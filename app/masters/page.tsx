import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MasterItem, type HistoryEntry, type FieldSpec } from "@/components/master-item";
import { NewMasterCode } from "@/components/new-master-code";
import { listMasterCodes, listMasterHistory } from "@/lib/masters";
import type {
  MasterRecordBase,
  MaterialRecord,
  LaborRateRecord,
  PackingCostRecord,
  TransportationRecord,
} from "@/lib/masters";

export const dynamic = "force-dynamic";

const MATERIAL_FIELDS: FieldSpec[] = [{ key: "pricePerKg", label: "Price (THB/kg)" }];
const LABOR_FIELDS: FieldSpec[] = [{ key: "hourlyChargeTHB", label: "Hourly Charge (THB/h)", step: 1 }];
const PACKING_FIELDS: FieldSpec[] = [
  { key: "priceTHB", label: "Price (THB)" },
  { key: "qtyPerUnit", label: "Qty/Unit", step: 1 },
];
const TRANSPORT_FIELDS: FieldSpec[] = [
  { key: "vehicleTHB", label: "Vehicle (THB)", step: 1 },
  { key: "fuelTHB", label: "Fuel (THB)", step: 1 },
  { key: "qtyPerTrip", label: "Qty/Trip", step: 1 },
];

function toHistory<T extends MasterRecordBase>(
  records: { data: T }[],
  fields: FieldSpec[],
  displayNameKey?: keyof T
): HistoryEntry[] {
  return records.map(({ data }) => ({
    effectiveFrom: data.effectiveFrom,
    recordedBy: data.recordedBy,
    note: data.note,
    displayName: displayNameKey ? String(data[displayNameKey]) : undefined,
    values: Object.fromEntries(fields.map((f) => [f.key, Number((data as unknown as Record<string, number>)[f.key])])),
  }));
}

export default async function MastersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/quotes");
  }

  const [materialCodes, packingCodes] = await Promise.all([
    listMasterCodes("materials"),
    listMasterCodes("packing-costs"),
  ]);

  const [materials, packingItems, laborHistory, transportHistory] = await Promise.all([
    Promise.all(
      materialCodes.map(async (code) => ({
        code,
        history: toHistory<MaterialRecord>(await listMasterHistory("materials", code), MATERIAL_FIELDS, "displayName"),
      }))
    ),
    Promise.all(
      packingCodes.map(async (code) => ({
        code,
        history: toHistory<PackingCostRecord>(
          await listMasterHistory("packing-costs", code),
          PACKING_FIELDS,
          "displayName"
        ),
      }))
    ),
    toHistory<LaborRateRecord>(await listMasterHistory("labor-rates", "default"), LABOR_FIELDS),
    toHistory<TransportationRecord>(await listMasterHistory("transportation", "default"), TRANSPORT_FIELDS),
  ]);

  return (
    <AppShell>
      <div className="flex flex-col h-screen overflow-auto">
        <div className="flex items-center gap-3 px-8 pt-6 pb-4">
          <div className="font-heading text-xl font-bold text-knt-navy">Master Data</div>
          <span className="text-[10.5px] font-bold text-knt-brown bg-knt-ivory border border-knt-pale-blue rounded-full px-2.5 py-1">
            Admin Only
          </span>
        </div>

        <div className="flex flex-col gap-6 px-8 pb-8">
          <Section title="Materials">
            <div className="flex flex-col gap-2.5">
              {materials.map((m) => (
                <MasterItem
                  key={m.code}
                  type="materials"
                  code={m.code}
                  displayLabel={m.history[0]?.displayName ?? m.code}
                  fields={MATERIAL_FIELDS}
                  history={m.history}
                  hasDisplayName
                />
              ))}
            </div>
            <div className="mt-3">
              <NewMasterCode type="materials" fields={MATERIAL_FIELDS} />
            </div>
          </Section>

          <Section title="Labor Rate">
            <MasterItem type="labor-rates" code="default" displayLabel="Hourly charge" fields={LABOR_FIELDS} history={laborHistory} />
          </Section>

          <Section title="Packing Costs">
            <div className="flex flex-col gap-2.5">
              {packingItems.map((p) => (
                <MasterItem
                  key={p.code}
                  type="packing-costs"
                  code={p.code}
                  displayLabel={p.history[0]?.displayName ?? p.code}
                  fields={PACKING_FIELDS}
                  history={p.history}
                  hasDisplayName
                />
              ))}
            </div>
            <div className="mt-3">
              <NewMasterCode type="packing-costs" fields={PACKING_FIELDS} />
            </div>
          </Section>

          <Section title="Transportation">
            <MasterItem
              type="transportation"
              code="default"
              displayLabel="Vehicle / Fuel / Qty per trip"
              fields={TRANSPORT_FIELDS}
              history={transportHistory}
            />
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[14px] border border-gray-100 p-5">
      <div className="text-sm font-bold text-knt-navy mb-3">{title}</div>
      {children}
    </div>
  );
}
