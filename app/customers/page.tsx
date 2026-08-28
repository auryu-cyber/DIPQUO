import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CustomerList } from "@/components/customer-list";
import { listCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/quotes");
  }

  const customers = await listCustomers();

  return (
    <AppShell>
      <div className="flex flex-col h-screen overflow-auto">
        <div className="flex items-center gap-3 px-8 pt-6 pb-4">
          <div className="font-heading text-xl font-bold text-knt-navy">Customer Master</div>
          <span className="text-[10.5px] font-bold text-knt-brown bg-knt-ivory border border-knt-pale-blue rounded-full px-2.5 py-1">
            Admin Only
          </span>
        </div>
        <div className="px-8 pb-8">
          <CustomerList customers={customers} />
        </div>
      </div>
    </AppShell>
  );
}
