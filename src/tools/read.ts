/** Read tools — always registered. Backed by Arctic Shift, no auth. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import {
  searchPosts,
  searchComments,
  getPostsByIds,
  getPostComments,
  getSubreddit,
  getSubredditRules,
} from "../arctic.js";
import { formatPost, formatComment, formatSubreddit } from "../format.js";
import { fail, handle, mapSort } from "./util.js";

export function registerReadTools(server: McpServer, config: Config): void {
  server.registerTool(
    "search_reddit",
    {
      title: "Search Reddit",
      description:
        "Search archived Reddit posts by keyword, subreddit, and/or author (Arctic Shift). " +
        "A `query` keyword requires `subreddit` or `author`. Data is near-live (minutes behind).",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Keyword searched in title + body. Requires subreddit or author to also be set."),
        subreddit: z.string().optional().describe("Subreddit name without 'r/' (e.g. weddingplanning)."),
        author: z.string().optional().describe("Reddit username without 'u/'."),
        sort: z.enum(["new", "old"]).optional().describe("new = newest first (default); old = oldest first."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results 1-100 (default 25)."),
        after: z.string().optional().describe("Only results on/after this date or UNIX time, e.g. 2024-01-01."),
        before: z.string().optional().describe("Only results before this date or UNIX time."),
      },
    },
    async ({ query, subreddit, author, sort, limit, after, before }) => {
      if (!subreddit && !author) {
        return fail("Provide a `subreddit` and/or `author` (Arctic Shift keyword search needs at least one).");
      }
      return handle(async () => {
        const posts = await searchPosts(config, {
          query,
          subreddit,
          author,
          sort: mapSort(sort),
          limit,
          after,
          before,
        });
        return { count: posts.length, posts: posts.map((p) => formatPost(p)) };
      });
    },
  );

  server.registerTool(
    "get_subreddit_posts",
    {
      title: "Get Subreddit Posts",
      description: "List recent posts from a subreddit, chronologically (archive sorts by time, not score).",
      inputSchema: {
        subreddit: z.string().describe("Subreddit name without 'r/'."),
        sort: z.enum(["new", "old"]).optional().describe("new = newest first (default); old = oldest first."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results 1-100 (default 25)."),
        after: z.string().optional().describe("Only posts on/after this date or UNIX time."),
        before: z.string().optional().describe("Only posts before this date or UNIX time."),
      },
    },
    async ({ subreddit, sort, limit, after, before }) =>
      handle(async () => {
        const posts = await searchPosts(config, { subreddit, sort: mapSort(sort), limit, after, before });
        return { count: posts.length, posts: posts.map((p) => formatPost(p)) };
      }),
  );

  server.registerTool(
    "get_reddit_post",
    {
      title: "Get Reddit Post",
      description: "Fetch a single post (with full selftext) by id, fullname (t3_…), or URL.",
      inputSchema: {
        id_or_url: z.string().describe("Post id (abc123), fullname (t3_abc123), or a reddit.com permalink."),
      },
    },
    async ({ id_or_url }) =>
      handle(async () => {
        const posts = await getPostsByIds(config, [id_or_url]);
        if (posts.length === 0) return { found: false, message: `No archived post found for "${id_or_url}".` };
        return formatPost(posts[0], { full: true });
      }),
  );

  server.registerTool(
    "get_post_comments",
    {
      title: "Get Post Comments",
      description:
        "Fetch a post's comments (flat, chronological). Use parent_id/link_id on each to reconstruct threads.",
      inputSchema: {
        post_id_or_url: z.string().describe("Post id, fullname (t3_…), or permalink."),
        limit: z.number().int().min(1).max(100).optional().describe("Max comments 1-100 (default 100)."),
      },
    },
    async ({ post_id_or_url, limit }) =>
      handle(async () => {
        const comments = await getPostComments(config, post_id_or_url, limit);
        return { count: comments.length, comments: comments.map(formatComment) };
      }),
  );

  server.registerTool(
    "get_subreddit_info",
    {
      title: "Get Subreddit Info",
      description: "Subreddit metadata (subscribers, description, created date) plus its rules.",
      inputSchema: {
        subreddit: z.string().describe("Subreddit name without 'r/'."),
      },
    },
    async ({ subreddit }) =>
      handle(async () => {
        const [info, rules] = await Promise.all([
          getSubreddit(config, subreddit),
          getSubredditRules(config, subreddit).catch(() => null),
        ]);
        if (!info) return { found: false, message: `No subreddit data for "${subreddit}".` };
        return { subreddit: formatSubreddit(info), rules };
      }),
  );

  server.registerTool(
    "get_user_posts",
    {
      title: "Get User Posts",
      description: "List posts submitted by a Reddit user.",
      inputSchema: {
        username: z.string().describe("Reddit username without 'u/'."),
        sort: z.enum(["new", "old"]).optional().describe("new = newest first (default); old = oldest first."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results 1-100 (default 25)."),
      },
    },
    async ({ username, sort, limit }) =>
      handle(async () => {
        const posts = await searchPosts(config, { author: username, sort: mapSort(sort), limit });
        return { count: posts.length, posts: posts.map((p) => formatPost(p)) };
      }),
  );

  server.registerTool(
    "get_user_comments",
    {
      title: "Get User Comments",
      description: "List comments written by a Reddit user.",
      inputSchema: {
        username: z.string().describe("Reddit username without 'u/'."),
        sort: z.enum(["new", "old"]).optional().describe("new = newest first (default); old = oldest first."),
        limit: z.number().int().min(1).max(100).optional().describe("Max results 1-100 (default 25)."),
      },
    },
    async ({ username, sort, limit }) =>
      handle(async () => {
        const comments = await searchComments(config, { author: username, sort: mapSort(sort), limit });
        return { count: comments.length, comments: comments.map(formatComment) };
      }),
  );
}
