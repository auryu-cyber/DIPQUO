import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuotesByIds, listQuoteIndex } from "@/lib/quotes";
import { buildXlsx } from "@/lib/export";
import { appendLog } from "@/lib/logs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",") : (await listQuoteIndex()).map((q) => `${q.id}/${q.variant}`);
  const quotes = await getQuotesByIds(ids);
  const buffer = await buildXlsx(quotes);

  await appendLog(
    "activity",
    {
      type: "activity",
      at: new Date().toISOString(),
      user: session.user.email,
      action: "exported",
      target: `${quotes.length} quotes`,
      detail: "Downloaded Excel",
    },
    session.user.email
  ).catch((err) => console.error("Failed to log export", err));

  return new NextResponse(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dip-quotes-${Date.now()}.xlsx"`,
    },
  });
}
