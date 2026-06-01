/** Write tools — registered ONLY when Reddit credentials are configured. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RedditClient } from "../reddit.js";
import { toThingFullname } from "../format.js";
import { fail, handle } from "./util.js";

const VOTE_DIR = { up: 1, down: -1, clear: 0 } as const;

export function registerWriteTools(server: McpServer, reddit: RedditClient): void {
  server.registerTool(
    "submit_post",
    {
      title: "Submit Post",
      description: "Create a new post in a subreddit (text/self post or link). Requires write credentials.",
      inputSchema: {
        subreddit: z.string().describe("Target subreddit without 'r/'."),
        title: z.string().min(1).describe("Post title."),
        kind: z.enum(["self", "link"]).optional().describe("self = text post (default); link = URL post."),
        text: z.string().optional().describe("Body markdown for a self post."),
        url: z.string().url().optional().describe("URL for a link post (required when kind = link)."),
        nsfw: z.boolean().optional().describe("Mark NSFW."),
        spoiler: z.boolean().optional().describe("Mark spoiler."),
      },
    },
    async ({ subreddit, title, kind, text, url, nsfw, spoiler }) => {
      const postKind = kind ?? "self";
      if (postKind === "link" && !url) return fail("kind 'link' requires a `url`.");
      return handle(async () => {
        const res = await reddit.submitPost({ subreddit, title, kind: postKind, text, url, nsfw, spoiler });
        const data = res?.json?.data ?? {};
        return { submitted: true, id: data.id ?? null, name: data.name ?? null, url: data.url ?? null };
      });
    },
  );

  server.registerTool(
    "reply",
    {
      title: "Reply to Post or Comment",
      description: "Post a comment in reply to a post (t3_…) or another comment (t1_…). Requires write credentials.",
      inputSchema: {
        parent_id: z.string().describe("Fullname (t3_… post or t1_… comment) or a permalink to reply to."),
        text: z.string().min(1).describe("Comment markdown."),
      },
    },
    async ({ parent_id, text }) =>
      handle(async () => {
        const res = await reddit.reply(toThingFullname(parent_id), text);
        const thing = res?.json?.data?.things?.[0]?.data ?? {};
        return {
          replied: true,
          id: thing.id ?? null,
          name: thing.name ?? null,
          permalink: thing.permalink ? `https://www.reddit.com${thing.permalink}` : null,
        };
      }),
  );

  server.registerTool(
    "vote",
    {
      title: "Vote",
      description: "Upvote, downvote, or clear your vote on a post or comment. Requires write credentials.",
      inputSchema: {
        id: z.string().describe("Fullname (t3_… / t1_…) or permalink of the thing to vote on."),
        direction: z.enum(["up", "down", "clear"]).describe("up, down, or clear (remove your vote)."),
      },
    },
    async ({ id, direction }) =>
      handle(async () => {
        const fullname = toThingFullname(id);
        await reddit.vote(fullname, VOTE_DIR[direction]);
        return { ok: true, id: fullname, direction };
      }),
  );

  server.registerTool(
    "edit_content",
    {
      title: "Edit Post or Comment",
      description: "Edit the body of your own self-post or comment. Requires write credentials.",
      inputSchema: {
        id: z.string().describe("Fullname (t3_… self post / t1_… comment) or permalink."),
        text: z.string().min(1).describe("New markdown body."),
      },
    },
    async ({ id, text }) =>
      handle(async () => {
        const res = await reddit.edit(toThingFullname(id), text);
        const thing = res?.json?.data?.things?.[0]?.data ?? {};
        return { edited: true, id: thing.id ?? toThingFullname(id) };
      }),
  );

  server.registerTool(
    "delete_content",
    {
      title: "Delete Post or Comment",
      description: "Delete your own post or comment. Requires write credentials.",
      inputSchema: {
        id: z.string().describe("Fullname (t3_… / t1_…) or permalink of the thing to delete."),
      },
    },
    async ({ id }) =>
      handle(async () => {
        const fullname = toThingFullname(id);
        await reddit.remove(fullname);
        return { deleted: true, id: fullname };
      }),
  );
}
