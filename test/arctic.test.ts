import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, clampLimit, MAX_LIMIT } from "../src/arctic.js";

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
