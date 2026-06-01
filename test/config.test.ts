import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, writeEnabled, DEFAULT_USER_AGENT } from "../src/config.js";

test("read-only when no Reddit creds", () => {
  const c = loadConfig({});
  assert.equal(c.reddit, undefined);
  assert.equal(writeEnabled(c), false);
  assert.equal(c.userAgent, DEFAULT_USER_AGENT);
  assert.equal(c.arcticBase, "https://arctic-shift.photon-reddit.com/api");
});

test("write enabled with app + password login", () => {
  const c = loadConfig({
    REDDIT_CLIENT_ID: "id",
    REDDIT_CLIENT_SECRET: "secret",
    REDDIT_USERNAME: "user",
    REDDIT_PASSWORD: "pass",
  });
  assert.equal(writeEnabled(c), true);
  assert.equal(c.reddit?.username, "user");
});

test("write enabled with app + refresh token", () => {
  const c = loadConfig({
    REDDIT_CLIENT_ID: "id",
    REDDIT_CLIENT_SECRET: "secret",
    REDDIT_REFRESH_TOKEN: "tok",
  });
  assert.equal(writeEnabled(c), true);
  assert.equal(c.reddit?.refreshToken, "tok");
});

test("NOT enabled with app but no login", () => {
  const c = loadConfig({ REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "secret" });
  assert.equal(writeEnabled(c), false);
});

test("NOT enabled with login but no app", () => {
  const c = loadConfig({ REDDIT_USERNAME: "user", REDDIT_PASSWORD: "pass" });
  assert.equal(writeEnabled(c), false);
});

test("base trailing slash stripped and custom UA respected", () => {
  const c = loadConfig({
    ARCTIC_SHIFT_BASE: "https://example.com/api/",
    ARCTIC_SHIFT_USER_AGENT: "custom/1.0",
  });
  assert.equal(c.arcticBase, "https://example.com/api");
  assert.equal(c.userAgent, "custom/1.0");
});
