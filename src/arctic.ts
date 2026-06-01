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

async function arcticGet(
  config: Config,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<any> {
  const url = buildUrl(config.arcticBase, path, params);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": config.userAgent, Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(`Network error calling Arctic Shift (${path}): ${(err as Error).message}`);
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
    throw new Error(`Arctic Shift API ${res.status} (${path}): ${body.slice(0, 200)}`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error(`Arctic Shift returned non-JSON for ${path}.`);
  }
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
