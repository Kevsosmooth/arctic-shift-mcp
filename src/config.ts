/**
 * Configuration + capability detection.
 *
 * Reads are always available (Arctic Shift, no auth). Write tools are only
 * exposed when a full set of Reddit API credentials is present in the
 * environment — that is the entire "read by default, write opt-in" contract.
 */

export interface RedditCreds {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  /** Password-grant (Reddit "script" app) — used when no refreshToken is set. */
  username?: string;
  password?: string;
  /** Refresh-token grant — preferred if present. */
  refreshToken?: string;
}

export interface Config {
  /** Arctic Shift API base, no trailing slash. */
  arcticBase: string;
  /** User-Agent sent to both Arctic Shift and Reddit. */
  userAgent: string;
  /** Present only when write mode is enabled. */
  reddit?: RedditCreds;
}

export const DEFAULT_USER_AGENT =
  "arctic-shift-mcp/0.1 (+https://github.com/Kevsosmooth/arctic-shift-mcp)";

export const DEFAULT_ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const userAgent =
    env.ARCTIC_SHIFT_USER_AGENT?.trim() ||
    env.REDDIT_USER_AGENT?.trim() ||
    DEFAULT_USER_AGENT;

  const arcticBase = (env.ARCTIC_SHIFT_BASE?.trim() || DEFAULT_ARCTIC_BASE).replace(
    /\/+$/,
    "",
  );

  const clientId = env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = env.REDDIT_CLIENT_SECRET?.trim();
  const username = env.REDDIT_USERNAME?.trim();
  const password = env.REDDIT_PASSWORD?.trim();
  const refreshToken = env.REDDIT_REFRESH_TOKEN?.trim();

  let reddit: RedditCreds | undefined;
  const hasApp = Boolean(clientId && clientSecret);
  const hasLogin = Boolean((username && password) || refreshToken);
  if (hasApp && hasLogin) {
    reddit = {
      clientId: clientId!,
      clientSecret: clientSecret!,
      userAgent,
      username,
      password,
      refreshToken,
    };
  }

  return { arcticBase, userAgent, reddit };
}

export function writeEnabled(config: Config): config is Config & { reddit: RedditCreds } {
  return config.reddit !== undefined;
}
