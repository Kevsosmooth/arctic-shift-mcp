import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePostId,
  stripPrefix,
  toThingFullname,
  unixToIso,
  formatPost,
  formatComment,
  formatSubreddit,
} from "../src/format.js";

test("stripPrefix removes reddit type prefixes", () => {
  assert.equal(stripPrefix("t3_abc123"), "abc123");
  assert.equal(stripPrefix("t1_def456"), "def456");
  assert.equal(stripPrefix("abc123"), "abc123");
});

test("parsePostId from bare id, fullname, and URL", () => {
  assert.equal(parsePostId("1m04o11"), "1m04o11");
  assert.equal(parsePostId("t3_1m04o11"), "1m04o11");
  assert.equal(
    parsePostId("https://www.reddit.com/r/weddingplanning/comments/1m04o11/just_got_engaged/"),
    "1m04o11",
  );
  assert.equal(parsePostId("HTTPS://reddit.com/comments/1M04O11"), "1m04o11");
});

test("toThingFullname keeps fullnames, derives from URLs, rejects bare ids", () => {
  assert.equal(toThingFullname("t3_abc123"), "t3_abc123");
  assert.equal(toThingFullname("t1_def456"), "t1_def456");
  assert.equal(
    toThingFullname("https://www.reddit.com/r/x/comments/1abc/some_title/def456/"),
    "t1_def456",
  );
  assert.equal(toThingFullname("https://www.reddit.com/r/x/comments/1abc/some_title/"), "t3_1abc");
  assert.throws(() => toThingFullname("abc123"), /fullname/i);
});

test("unixToIso handles valid and invalid input", () => {
  assert.equal(unixToIso(0), "");
  assert.equal(unixToIso(undefined), "");
  assert.equal(unixToIso("not-a-number"), "");
  assert.equal(unixToIso(1700000000).slice(0, 4), "2023");
});

test("formatPost maps fields and truncates long selftext", () => {
  const long = "x".repeat(700);
  const p = formatPost({
    id: "abc",
    subreddit: "weddingplanning",
    title: "Hi",
    author: "someone",
    created_utc: 1700000000,
    score: 12,
    num_comments: 3,
    permalink: "/r/weddingplanning/comments/abc/hi/",
    selftext: long,
    is_self: true,
  });
  assert.equal(p.id, "abc");
  assert.equal(p.fullname, "t3_abc");
  assert.equal(p.subreddit, "weddingplanning");
  assert.equal(p.permalink, "https://www.reddit.com/r/weddingplanning/comments/abc/hi/");
  assert.equal(p.selftext_truncated, true);
  assert.ok(p.selftext!.endsWith("…"));
  assert.ok(p.selftext!.length < long.length);
});

test("formatPost full mode keeps selftext intact", () => {
  const long = "y".repeat(700);
  const p = formatPost({ id: "abc", selftext: long }, { full: true });
  assert.equal(p.selftext, long);
  assert.equal(p.selftext_truncated, undefined);
});

test("formatComment maps fields", () => {
  const c = formatComment({
    id: "c1",
    subreddit: "wedding",
    author: "u1",
    body: "nice",
    score: 5,
    created_utc: 1700000000,
    link_id: "t3_abc",
    parent_id: "t3_abc",
    permalink: "/r/wedding/comments/abc/x/c1/",
  });
  assert.equal(c.fullname, "t1_c1");
  assert.equal(c.body, "nice");
  assert.equal(c.permalink, "https://www.reddit.com/r/wedding/comments/abc/x/c1/");
});

test("formatSubreddit maps metadata", () => {
  const s = formatSubreddit({
    display_name: "weddingplanning",
    title: "Wedding Planning",
    subscribers: 123456,
    public_description: "plan stuff",
    created_utc: 1300000000,
    over18: false,
  });
  assert.equal(s.name, "weddingplanning");
  assert.equal(s.subscribers, 123456);
  assert.equal(s.over18, false);
  assert.equal(s.url, "https://www.reddit.com/r/weddingplanning/");
});
