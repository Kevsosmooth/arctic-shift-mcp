import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, clampLimit, MAX_LIMIT, isTransientStatus, searchPosts } from "../src/arctic.js";
import type { Config } from "../src/config.js";

test("buildUrl sets params and drops undefined/empty/NaN", () => {
  const url = buildUrl("https://api.test/api", "/posts/search", {
    subreddit: "weddingplanning",
    query: "free companies",
    limit: 25,
    author: undefined,
    title: "",
    before: NaN,
  });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://api.test/api/posts/search");
  assert.equal(u.searchParams.get("subreddit"), "weddingplanning");
  assert.equal(u.searchParams.get("query"), "free companies");
  assert.equal(u.searchParams.get("limit"), "25");
  assert.equal(u.searchParams.has("author"), false);
  assert.equal(u.searchParams.has("title"), false);
  assert.equal(u.searchParams.has("before"), false);
});

test("buildUrl normalizes a trailing slash on base", () => {
  const url = buildUrl("https://api.test/api/", "/comments/search", { link_id: "abc" });
  assert.ok(url.startsWith("https://api.test/api/comments/search?"));
});

test("clampLimit applies default, floor, and bounds", () => {
  assert.equal(clampLimit(undefined), 25);
  assert.equal(clampLimit(10), 10);
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(9999), MAX_LIMIT);
  assert.equal(clampLimit(12.9), 12);
});

test("isTransientStatus flags retryable statuses", () => {
  assert.equal(isTransientStatus(522), true);
  assert.equal(isTransientStatus(503), true);
  assert.equal(isTransientStatus(500), true);
  assert.equal(isTransientStatus(408), true);
  assert.equal(isTransientStatus(429), false); // handled separately, never retried here
  assert.equal(isTransientStatus(404), false);
  assert.equal(isTransientStatus(400), false);
  assert.equal(isTransientStatus(501), false);
});

test("searchPosts retries a transient 522 then succeeds", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return new Response("upstream timeout", { status: 522 });
    return new Response(JSON.stringify({ data: [{ id: "abc", title: "ok" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const cfg: Config = { arcticBase: "https://api.test/api", userAgent: "test/1.0" };
    const posts = await searchPosts(cfg, { subreddit: "test", limit: 1 });
    assert.equal(calls, 2);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, "abc");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("searchPosts gives up after retries on persistent 5xx", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("down", { status: 503 });
  }) as typeof fetch;
  try {
    const cfg: Config = { arcticBase: "https://api.test/api", userAgent: "test/1.0" };
    await assert.rejects(() => searchPosts(cfg, { subreddit: "test" }), /503/);
    assert.equal(calls, 3); // 1 initial + MAX_RETRIES (2)
  } finally {
    globalThis.fetch = realFetch;
  }
});
