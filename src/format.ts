/**
 * Pure helpers: id/URL parsing + trimming raw Reddit objects down to the
 * fields that actually matter to an LLM. No network, fully unit-testable.
 *
 * Raw inputs are typed `any` on purpose: the Arctic Shift / Reddit payloads
 * are large, dynamic JSON. We narrow into the typed Clean* outputs below.
 */

export interface CleanPost {
  id: string;
  fullname: string;
  subreddit: string;
  title: string;
  author: string;
  created_utc: number;
  created_iso: string;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  is_self: boolean;
  over_18: boolean;
  link_flair_text: string | null;
  selftext?: string;
  selftext_truncated?: boolean;
}

export interface CleanComment {
  id: string;
  fullname: string;
  subreddit: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  created_iso: string;
  permalink: string;
  link_id: string;
  parent_id: string;
}

export interface CleanSubreddit {
  name: string;
  title: string | null;
  subscribers: number | null;
  public_description: string | null;
  created_iso: string | null;
  over18: boolean | null;
  url: string | null;
}

const SELFTEXT_PREVIEW = 600;

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Unix seconds -> ISO 8601 (UTC). Empty string for missing/invalid input. */
export function unixToIso(ts: unknown): string {
  const n = num(ts, NaN);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}

/** Remove a Reddit type prefix (t1_, t3_, ...) if present. */
export function stripPrefix(id: string): string {
  return id.trim().replace(/^t\d+_/i, "");
}

/** Extract the base-36 post id from a bare id, fullname, or any Reddit URL. */
export function parsePostId(input: string): string {
  const s = input.trim();
  const m = s.match(/\/comments\/([a-z0-9]+)/i);
  if (m) return m[1]!.toLowerCase();
  return stripPrefix(s).toLowerCase();
}

/**
 * Resolve a Reddit "fullname" (t3_post / t1_comment) from a fullname, a bare
 * id is rejected (ambiguous), or a permalink. Used by write tools that must
 * target a specific thing.
 */
export function toThingFullname(input: string): string {
  const s = input.trim();
  if (/^t[1-6]_[a-z0-9]+$/i.test(s)) return s.toLowerCase();
  const comment = s.match(/\/comments\/[a-z0-9]+\/[^/]+\/([a-z0-9]+)/i);
  if (comment) return `t1_${comment[1]!.toLowerCase()}`;
  const post = s.match(/\/comments\/([a-z0-9]+)/i);
  if (post) return `t3_${post[1]!.toLowerCase()}`;
  throw new Error(
    `Could not determine a Reddit fullname from "${input}". ` +
      `Pass a fullname like t3_abc123 (post) or t1_def456 (comment), or a full permalink.`,
  );
}

export function formatPost(raw: any, opts: { full?: boolean } = {}): CleanPost {
  const id = stripPrefix(String(raw?.id ?? raw?.name ?? ""));
  const permalink = raw?.permalink
    ? `https://www.reddit.com${raw.permalink}`
    : `https://www.reddit.com/comments/${id}`;
  const selftext = typeof raw?.selftext === "string" ? raw.selftext : "";
  const truncate = !opts.full && selftext.length > SELFTEXT_PREVIEW;

  const post: CleanPost = {
    id,
    fullname: `t3_${id}`,
    subreddit: String(raw?.subreddit ?? ""),
    title: String(raw?.title ?? ""),
    author: String(raw?.author ?? "[unknown]"),
    created_utc: num(raw?.created_utc),
    created_iso: unixToIso(raw?.created_utc),
    score: num(raw?.score),
    num_comments: num(raw?.num_comments),
    permalink,
    url: String(raw?.url ?? permalink),
    is_self: Boolean(raw?.is_self),
    over_18: Boolean(raw?.over_18),
    link_flair_text: raw?.link_flair_text ?? null,
  };
  if (selftext) {
    post.selftext = truncate ? selftext.slice(0, SELFTEXT_PREVIEW) + "…" : selftext;
    if (truncate) post.selftext_truncated = true;
  }
  return post;
}

export function formatComment(raw: any): CleanComment {
  const id = stripPrefix(String(raw?.id ?? raw?.name ?? ""));
  return {
    id,
    fullname: `t1_${id}`,
    subreddit: String(raw?.subreddit ?? ""),
    author: String(raw?.author ?? "[unknown]"),
    body: String(raw?.body ?? ""),
    score: num(raw?.score),
    created_utc: num(raw?.created_utc),
    created_iso: unixToIso(raw?.created_utc),
    permalink: raw?.permalink ? `https://www.reddit.com${raw.permalink}` : "",
    link_id: String(raw?.link_id ?? ""),
    parent_id: String(raw?.parent_id ?? ""),
  };
}

export function formatSubreddit(raw: any): CleanSubreddit {
  const name = String(raw?.display_name ?? raw?.subreddit ?? "");
  return {
    name,
    title: raw?.title ?? null,
    subscribers: typeof raw?.subscribers === "number" ? raw.subscribers : null,
    public_description: raw?.public_description ?? raw?.description ?? null,
    created_iso: raw?.created_utc ? unixToIso(raw.created_utc) : null,
    over18: typeof raw?.over18 === "boolean" ? raw.over18 : null,
    url: raw?.url
      ? `https://www.reddit.com${raw.url}`
      : name
        ? `https://www.reddit.com/r/${name}/`
        : null,
  };
}
