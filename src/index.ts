#!/usr/bin/env node
/**
 * arctic-shift-mcp — a zero-auth, drop-in Reddit MCP server.
 *
 * Reads (search/posts/comments/users/subreddits) come from the Arctic Shift
 * archive with no Reddit login. Write tools (submit/reply/vote/edit/delete)
 * register only when Reddit API credentials are present in the environment.
 *
 * NOTE: all diagnostics go to stderr — stdout is the MCP JSON-RPC channel.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, writeEnabled } from "./config.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import { createRedditClient } from "./reddit.js";

const VERSION = "0.1.1";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = new McpServer({ name: "arctic-shift-mcp", version: VERSION });

  registerReadTools(server, config);

  if (writeEnabled(config)) {
    registerWriteTools(server, createRedditClient(config.reddit));
    const who = config.reddit.username ?? "refresh-token account";
    console.error(`[arctic-shift-mcp] write mode ENABLED (${who}).`);
  } else {
    console.error(
      "[arctic-shift-mcp] read-only mode. Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET " +
        "and (REDDIT_USERNAME + REDDIT_PASSWORD or REDDIT_REFRESH_TOKEN) to enable writes.",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[arctic-shift-mcp] v${VERSION} ready on stdio.`);
}

main().catch((err) => {
  console.error("[arctic-shift-mcp] fatal:", err);
  process.exit(1);
});
