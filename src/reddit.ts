/**
 * Reddit OAuth write client. Only constructed when credentials are present.
 * Supports a "script" app password grant or a refresh token. Tokens are
 * cached in memory until shortly before expiry.
 *
 * Reddit requires a unique, descriptive User-Agent or it will throttle/refuse.
 */

import type { RedditCreds } from "./config.js";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";

export interface RedditClient {
  submitPost(p: {
    subreddit: string;
    title: string;
    kind: "self" | "link";
    text?: string;
    url?: string;
    nsfw?: boolean;
    spoiler?: boolean;
  }): Promise<any>;
  reply(parentFullname: string, text: string): Promise<any>;
  vote(fullname: string, dir: -1 | 0 | 1): Promise<any>;
  edit(thingFullname: string, text: string): Promise<any>;
  remove(thingFullname: string): Promise<any>;
}

export function createRedditClient(creds: RedditCreds): RedditClient {
  let token: string | null = null;
  let expiresAt = 0;

  async function getToken(): Promise<string> {
    const now = Date.now();
    if (token && now < expiresAt - 30_000) return token;

    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
    const body = new URLSearchParams();
    if (creds.refreshToken) {
      body.set("grant_type", "refresh_token");
      body.set("refresh_token", creds.refreshToken);
    } else {
      body.set("grant_type", "password");
      body.set("username", creds.username ?? "");
      body.set("password", creds.password ?? "");
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": creds.userAgent,
      },
      body,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(
        `Reddit auth failed (HTTP ${res.status}): ${txt.slice(0, 200)}. ` +
          `Check REDDIT_CLIENT_ID/SECRET and your login (script app + password, or refresh token).`,
      );
    }
    const json: any = await res.json();
    if (!json?.access_token) throw new Error("Reddit auth: response had no access_token.");
    token = json.access_token as string;
    expiresAt = now + Number(json.expires_in ?? 3600) * 1000;
    return token;
  }

  async function apiPost(path: string, form: Record<string, string>): Promise<any> {
    const accessToken = await getToken();
    const body = new URLSearchParams({ ...form, api_type: "json", raw_json: "1" });
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": creds.userAgent,
      },
      body,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Reddit API ${res.status} (${path}): ${txt.slice(0, 300)}`);
    }
    const json: any = await res.json().catch(() => ({}));
    const errors = json?.json?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(`Reddit rejected ${path}: ${JSON.stringify(errors)}`);
    }
    return json;
  }

  return {
    submitPost(p) {
      const form: Record<string, string> = { sr: p.subreddit, title: p.title, kind: p.kind };
      if (p.kind === "self") form.text = p.text ?? "";
      else form.url = p.url ?? "";
      if (p.nsfw) form.nsfw = "true";
      if (p.spoiler) form.spoiler = "true";
      return apiPost("/api/submit", form);
    },
    reply(parentFullname, text) {
      return apiPost("/api/comment", { thing_id: parentFullname, text });
    },
    vote(fullname, dir) {
      return apiPost("/api/vote", { id: fullname, dir: String(dir) });
    },
    edit(thingFullname, text) {
      return apiPost("/api/editusertext", { thing_id: thingFullname, text });
    },
    remove(thingFullname) {
      return apiPost("/api/del", { id: thingFullname });
    },
  };
}
