/**
 * Arctic Shift API client (read-only Reddit archive).
 * Docs: https://github.com/ArthurHeitmann/arctic_shift/tree/main/api
 *
 * No auth required. We send a descriptive User-Agent and surface rate-limit
 * (HTTP 429) clearly so callers know to back off / cache.
 */

import type { Config } from "./config.js";
import { parsePostId, stripPrefix } from "./format.js";

export const MAX_LIMIT = 100;

export function clampLimit(limit: number | undefined, def = 25, max = MAX_LIMIT): number {
  if (limit === undefined || !Number.isFinite(limit)) return def;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

/** Pure URL builder — drops undefined/empty/NaN params. Unit-tested. */
export function buildUrl(
  base: string,
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(base.replace(/\/+$/, "") + path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (typeof value === "number" && Number.isNaN(value)) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

const MAX_RETRIES = 2; // total attempts = 3
const RETRY_BASE_MS = 500; // backoff: 500ms, 1000ms
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Whether an HTTP status is worth retrying. Arctic Shift's free origin behind
 * Cloudflare intermittently 522s / 5xxs under load; 429 is handled separately
 * (we surface it, never retry it).
 */
export function isTransientStatus(status: number): boolean {
  if (status === 408 || status === 425) return true; // request timeout / too early
  return status >= 500 && status !== 501; // 5xx incl. Cloudflare 520-524, except "not implemented"
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function arcticGet(
  config: Config,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<any> {
  const url = buildUrl(config.arcticBase, path, params);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * attempt);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": config.userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // Network error or per-request timeout — retry.
      lastError = new Error(`Network error calling Arctic Shift (${path}): ${(err as Error).message}`);
      continue;
    }

    if (res.status === 429) {
      const reset = res.headers.get("x-ratelimit-reset");
      throw new Error(
        `Arctic Shift rate limit hit (HTTP 429)${reset ? `; retry in ~${reset}s` : ""}. ` +
          `Cache results or slow down — it is a shared free service.`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message = `Arctic Shift API ${res.status} (${path}): ${body.slice(0, 200)}`;
      if (isTransientStatus(res.status) && attempt < MAX_RETRIES) {
        lastError = new Error(message);
        continue;
      }
      throw new Error(message);
    }

    try {
      return await res.json();
    } catch {
      lastError = new Error(`Arctic Shift returned non-JSON for ${path}.`);
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }
  }

  throw lastError ?? new Error(`Arctic Shift request failed for ${path}.`);
}

function dataArray(json: any): any[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json)) return json;
  return [];
}

export interface PostSearchParams {
  subreddit?: string;
  author?: string;
  query?: string;
  title?: string;
  selftext?: string;
  sort?: "asc" | "desc";
  limit?: number;
  after?: string;
  before?: string;
}

export async function searchPosts(config: Config, p: PostSearchParams): Promise<any[]> {
  const json = await arcticGet(config, "/posts/search", {
    subreddit: p.subreddit,
    author: p.author,
    query: p.query,
    title: p.title,
    selftext: p.selftext,
    sort: p.sort ?? "desc",
    limit: clampLimit(p.limit),
    after: p.after,
    before: p.before,
  });
  return dataArray(json);
}

export interface CommentSearchParams {
  subreddit?: string;
  author?: string;
  body?: string;
  link_id?: string;
  sort?: "asc" | "desc";
  limit?: number;
  after?: string;
  before?: string;
}

export async function searchComments(config: Config, p: CommentSearchParams): Promise<any[]> {
  const json = await arcticGet(config, "/comments/search", {
    subreddit: p.subreddit,
    author: p.author,
    body: p.body,
    link_id: p.link_id ? stripPrefix(p.link_id) : undefined,
    sort: p.sort ?? "desc",
    limit: clampLimit(p.limit),
    after: p.after,
    before: p.before,
  });
  return dataArray(json);
}

export async function getPostsByIds(config: Config, ids: string[]): Promise<any[]> {
  const cleaned = ids.map((i) => parsePostId(i)).filter(Boolean);
  if (cleaned.length === 0) return [];
  const json = await arcticGet(config, "/posts/ids", { ids: cleaned.join(",") });
  return dataArray(json);
}

/** Comments of a post, flat + chronological. parent_id/link_id let you rebuild threads. */
export async function getPostComments(
  config: Config,
  postIdOrUrl: string,
  limit?: number,
): Promise<any[]> {
  return searchComments(config, {
    link_id: parsePostId(postIdOrUrl),
    sort: "asc",
    limit: clampLimit(limit, 100, MAX_LIMIT),
  });
}

export async function getSubreddit(config: Config, subreddit: string): Promise<any | null> {
  const json = await arcticGet(config, "/subreddits/search", {
    subreddit: stripPrefix(subreddit),
    limit: 1,
  });
  return dataArray(json)[0] ?? null;
}

export async function getSubredditRules(config: Config, subreddit: string): Promise<any> {
  const json = await arcticGet(config, "/subreddits/rules", {
    subreddits: stripPrefix(subreddit),
  });
  return json?.data ?? json ?? null;
}
