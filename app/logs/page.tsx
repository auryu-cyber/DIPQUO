import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
import { AppShell } from "@/components/app-shell";
import { readLogs, recentMonths } from "@/lib/logs";
import type { LoginLogEvent, ActivityLogEvent } from "@/lib/logs";

const ACTION_STYLE: Record<string, string> = {
  edited: "bg-knt-pale-blue text-knt-navy",
  exported: "bg-knt-blue/[0.14] text-[#0f6fa8]",
  created: "bg-knt-ivory text-knt-brown",
  access_denied: "bg-knt-red/[0.14] text-[#c73a3b]",
};

export default async function LogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/quotes");
  }

  const months = recentMonths(2);
  const [loginEvents, activityEvents] = await Promise.all([
    readLogs<LoginLogEvent>("login", months),
    readLogs<ActivityLogEvent>("activity", months),
  ]);

  return (
    <AppShell>
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 px-8 pt-6 pb-4">
          <div className="font-heading text-xl font-bold text-knt-navy">Activity Log</div>
          <span className="text-[10.5px] font-bold text-knt-brown bg-knt-ivory border border-knt-pale-blue rounded-full px-2.5 py-1">
            Admin Only
          </span>
        </div>

        <div className="flex-1 flex gap-5 px-8 pb-8 min-h-0">
          <div className="flex-1 bg-white rounded-[14px] border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 text-[13.5px] font-bold text-knt-navy">Login History</div>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Date / Time</Th>
                    <Th>User</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody>
                  {loginEvents.map((e, i) => (
                    <tr key={i}>
                      <Td>{new Date(e.at).toLocaleString()}</Td>
                      <Td>{e.user}</Td>
                      <Td>
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-full ${
                            e.result === "success" ? "bg-knt-blue/[0.14] text-[#0f6fa8]" : "bg-knt-red/[0.14] text-[#c73a3b]"
                          }`}
                        >
                          {e.result === "success" ? "Success" : "Failed (unauthorized domain)"}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {loginEvents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-sm text-gray-400 py-10">
                        No login events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex-[1.3] bg-white rounded-[14px] border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 text-[13.5px] font-bold text-knt-navy">Operation History</div>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>Date / Time</Th>
                    <Th>User</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {activityEvents.map((e, i) => (
                    <tr key={i}>
                      <Td>{new Date(e.at).toLocaleString()}</Td>
                      <Td>{e.user}</Td>
                      <Td>
                        <span className={`text-[11px] px-2.5 py-1 rounded-full ${ACTION_STYLE[e.action] ?? ""}`}>{e.action}</span>
                      </Td>
                      <Td>{e.target}</Td>
                      <Td className="text-gray-400">{e.detail ?? ""}</Td>
                    </tr>
                  ))}
                  {activityEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-gray-400 py-10">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-medium text-gray-500 px-4 py-2.5 border-b border-knt-pale-blue">{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-[12.5px] text-gray-700 px-4 py-2.5 border-b border-gray-100 ${className}`}>{children}</td>;
}
