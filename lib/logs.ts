import { getTextFile, putTextFile } from "@/lib/github";

export type LogKind = "login" | "activity";

export interface LoginLogEvent {
  type: "login";
  at: string;
  user: string;
  result: "success" | "failed_unauthorized_domain";
  ip?: string;
}

export interface ActivityLogEvent {
  type: "activity";
  at: string;
  user: string;
  action: "created" | "edited" | "exported" | "access_denied";
  target: string;
  detail?: string;
}

export type LogEvent = LoginLogEvent | ActivityLogEvent;

/**
 * Appends one event to this month's JSON-Lines log file, committing directly.
 * The architecture doc calls for buffering + batched commits to avoid one commit
 * per event at scale; this direct-append version is the simpler correct baseline
 * for the initial implementation and can be swapped for a buffered writer later
 * without changing the log file format or any reader.
 */
export async function appendLog(kind: LogKind, event: LogEvent, authorEmail: string): Promise<void> {
  const month = event.at.slice(0, 7); // YYYY-MM
  const path = `logs/${kind}/${month}.jsonl`;
  const existing = await getTextFile(path);
  const line = JSON.stringify(event);
  const newContent = existing ? existing.data + line + "\n" : line + "\n";
  await putTextFile(
    path,
    newContent,
    `log(${kind}): ${event.type === "login" ? event.result : event.action} by ${event.user}`,
    authorEmail,
    existing?.sha
  );
}

function parseJsonLines<T>(text: string): T[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

/** Reads and merges the given months' worth of a log kind, newest first. */
export async function readLogs<T>(kind: LogKind, months: string[]): Promise<T[]> {
  const results = await Promise.all(
    months.map(async (month) => {
      const file = await getTextFile(`logs/${kind}/${month}.jsonl`);
      return file ? parseJsonLines<T>(file.data) : [];
    })
  );
  return results.flat().reverse();
}

/** The current and previous N-1 months, as "YYYY-MM", newest first. */
export function recentMonths(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
}
