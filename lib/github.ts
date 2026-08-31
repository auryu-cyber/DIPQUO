import { Octokit } from "@octokit/rest";

const owner = process.env.GITHUB_DATA_OWNER ?? "auryu-cyber";
const repo = process.env.GITHUB_DATA_REPO ?? "dipquo-data";
const branch = process.env.GITHUB_DATA_BRANCH ?? "main";

function client() {
  const token = process.env.GITHUB_DATA_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_DATA_TOKEN is not set. See .env.example for required environment variables."
    );
  }
  console.log(
    `[github] client: owner=${owner} repo=${repo} branch=${branch} tokenLength=${token.length} tokenPrefix=${token.slice(0, 8)}`
  );
  return new Octokit({ auth: token });
}

export interface FileResult<T> {
  data: T;
  sha: string;
}

/** Read and JSON-parse a file from the data repo. Returns null if it does not exist. */
export async function getJsonFile<T>(path: string): Promise<FileResult<T> | null> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(res.data) || res.data.type !== "file" || !("content" in res.data)) {
      throw new Error(`${path} is not a file`);
    }
    const content = Buffer.from(res.data.content, "base64").toString("utf-8");
    return { data: JSON.parse(content) as T, sha: res.data.sha };
  } catch (err: unknown) {
    logFetchError("getJsonFile", path, err);
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Create or update a JSON file. Pass `sha` (from a prior read) to detect concurrent edits. */
export async function putJsonFile(
  path: string,
  data: unknown,
  message: string,
  authorEmail: string,
  sha?: string
): Promise<string> {
  const octokit = client();
  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf-8").toString("base64");
  try {
    const res = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content,
      branch,
      sha,
      committer: { name: authorEmail, email: authorEmail },
      author: { name: authorEmail, email: authorEmail },
    });
    return res.data.content?.sha ?? "";
  } catch (err: unknown) {
    if (isConflict(err)) {
      throw new QuoteConflictError(path);
    }
    throw err;
  }
}

export async function deleteFile(path: string, message: string, sha: string): Promise<void> {
  const octokit = client();
  await octokit.repos.deleteFile({ owner, repo, path, message, sha, branch });
}

/** List the files directly inside a directory (non-recursive). Empty array if the directory does not exist. */
export async function listDir(path: string): Promise<string[]> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(res.data)) return [];
    return res.data.filter((e) => e.type === "file").map((e) => e.name);
  } catch (err: unknown) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

/** List the sub-directories directly inside a directory. Empty array if it does not exist. */
export async function listSubdirs(path: string): Promise<string[]> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(res.data)) return [];
    return res.data.filter((e) => e.type === "dir").map((e) => e.name);
  } catch (err: unknown) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string | undefined;
  date: string | undefined;
  url: string;
}

/** Commit history for a single file — the basis for the "change history" view. */
export async function getFileHistory(path: string, perPage = 30): Promise<CommitInfo[]> {
  const octokit = client();
  const res = await octokit.repos.listCommits({ owner, repo, path, sha: branch, per_page: perPage });
  return res.data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    authorName: c.commit.author?.name,
    date: c.commit.author?.date,
    url: c.html_url,
  }));
}

/** Read a file's JSON content as of a specific commit (for viewing a past version). */
export async function getJsonFileAtRef<T>(path: string, ref: string): Promise<T | null> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(res.data) || res.data.type !== "file" || !("content" in res.data)) {
      return null;
    }
    const content = Buffer.from(res.data.content, "base64").toString("utf-8");
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Read a file's raw text content (for the append-only .jsonl log files). Returns null if it does not exist. */
export async function getTextFile(path: string): Promise<FileResult<string> | null> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(res.data) || res.data.type !== "file" || !("content" in res.data)) {
      throw new Error(`${path} is not a file`);
    }
    return { data: Buffer.from(res.data.content, "base64").toString("utf-8"), sha: res.data.sha };
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function putTextFile(
  path: string,
  text: string,
  message: string,
  authorEmail: string,
  sha?: string
): Promise<string> {
  const octokit = client();
  const content = Buffer.from(text, "utf-8").toString("base64");
  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content,
    branch,
    sha,
    committer: { name: authorEmail, email: authorEmail },
    author: { name: authorEmail, email: authorEmail },
  });
  return res.data.content?.sha ?? "";
}

export class QuoteConflictError extends Error {
  constructor(path: string) {
    super(`${path} was updated by someone else. Reload and try again.`);
    this.name = "QuoteConflictError";
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === 404;
}

/** Temporary diagnostic logging to distinguish "file genuinely absent" from an auth/permission error
 *  that GitHub also reports as 404 for private repos — visible in Vercel Runtime Logs. */
function logFetchError(fn: string, path: string, err: unknown): void {
  const status = typeof err === "object" && err !== null && "status" in err ? (err as { status: unknown }).status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[github] ${fn}(${path}) owner=${owner} repo=${repo} branch=${branch} status=${status} message=${message}`);
}

function isConflict(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === 409;
}
