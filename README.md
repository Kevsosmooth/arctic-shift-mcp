# arctic-shift-mcp

A zero-auth, drop-in **Reddit MCP server** backed by the [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift) archive.

Most Reddit MCP servers break because they hit Reddit's live API/pages, which now blocks data-center IPs and/or requires an authenticated app. This server reads from **Arctic Shift** instead — a continuously-updated public archive of Reddit — so search and read work with **no Reddit login at all**. Posting, replying, and voting are available too, but only switch on when you supply your own Reddit API credentials.

- ✅ **Search & read with no auth** — posts, comments, users, subreddits
- ✅ **Near-live data** — the archive trails real Reddit by minutes, not days
- ✅ **Write opt-in** — `submit_post`, `reply`, `vote`, `edit_content`, `delete_content` register only when credentials are set
- ✅ **Familiar tool names** — drop it in where a broken Reddit MCP used to be

---

## Quick start

### Claude Code

```bash
claude mcp add reddit -- npx -y github:Kevsosmooth/arctic-shift-mcp
```

### Any MCP client (Claude Desktop, Cursor, Windsurf, …)

Add to your MCP config (`.mcp.json`, `claude_desktop_config.json`, Cursor settings, etc.):

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "github:Kevsosmooth/arctic-shift-mcp"]
    }
  }
}
```

That's the full read-only setup. No keys, no account.

> Once published to npm you can swap `github:Kevsosmooth/arctic-shift-mcp` for just `arctic-shift-mcp`.

---

## Enabling write mode (optional)

Writing to Reddit requires *your own* Reddit account + API app — there's no way around that, and it's intentional: the read side stays auth-free for everyone, and only you can post as you.

1. Go to <https://www.reddit.com/prefs/apps> → **create another app…**
2. Choose **script**, set the redirect URI to `http://localhost:8080` (unused for password grant).
3. Note the **client id** (under the app name) and **secret**.
4. Add the credentials to the server's `env`:

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "github:Kevsosmooth/arctic-shift-mcp"],
      "env": {
        "REDDIT_CLIENT_ID": "your_client_id",
        "REDDIT_CLIENT_SECRET": "your_client_secret",
        "REDDIT_USERNAME": "your_username",
        "REDDIT_PASSWORD": "your_password"
      }
    }
  }
}
```

Prefer not to store a password? Use a refresh token instead:

```json
"env": {
  "REDDIT_CLIENT_ID": "your_client_id",
  "REDDIT_CLIENT_SECRET": "your_client_secret",
  "REDDIT_REFRESH_TOKEN": "your_refresh_token"
}
```

When valid credentials are present the server logs `write mode ENABLED` on startup and exposes the five write tools. Otherwise it runs read-only.

---

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `REDDIT_CLIENT_ID` | for writes | — | Reddit "script" app client id |
| `REDDIT_CLIENT_SECRET` | for writes | — | Reddit app secret |
| `REDDIT_USERNAME` | for writes* | — | Reddit account username (password grant) |
| `REDDIT_PASSWORD` | for writes* | — | Reddit account password (password grant) |
| `REDDIT_REFRESH_TOKEN` | for writes* | — | Alternative to username/password |
| `ARCTIC_SHIFT_USER_AGENT` | no | `arctic-shift-mcp/0.1 (+repo url)` | User-Agent sent to Arctic Shift & Reddit |
| `ARCTIC_SHIFT_BASE` | no | `https://arctic-shift.photon-reddit.com/api` | Override the archive endpoint |

\* Writes need an app **and** a login: either `USERNAME`+`PASSWORD`, or `REFRESH_TOKEN`.

---

## Tools

### Read (always available)

| Tool | Description |
|---|---|
| `search_reddit` | Search posts by `query` (keyword), `subreddit`, and/or `author`. A keyword needs a subreddit or author. |
| `get_subreddit_posts` | Recent posts in a subreddit, chronologically. |
| `get_reddit_post` | One post with full body, by id / `t3_…` / URL. |
| `get_post_comments` | A post's comments (flat + chronological; `parent_id`/`link_id` rebuild threads). |
| `get_subreddit_info` | Subreddit metadata + rules. |
| `get_user_posts` | Posts by a user. |
| `get_user_comments` | Comments by a user. |

### Write (only when credentials are set)

| Tool | Description |
|---|---|
| `submit_post` | Create a self/text or link post. |
| `reply` | Comment on a post (`t3_…`) or reply to a comment (`t1_…`). |
| `vote` | `up` / `down` / `clear` on a post or comment. |
| `edit_content` | Edit your own self-post or comment. |
| `delete_content` | Delete your own post or comment. |

---

## Limitations

- **Read is an archive.** It's continuously updated and usually only minutes behind live, but the very newest items (last few minutes on busy subs) may not be indexed yet, and live vote counts drift.
- **Listing is by time, not score.** Arctic Shift sorts by creation date, so `get_subreddit_posts` is chronological — there's no "top of all time" sort.
- **Writes always need your own Reddit app + login.** Read mode can never post; that's by design.

## How it works

Read tools call the Arctic Shift REST API (`/posts/search`, `/comments/search`, `/posts/ids`, `/subreddits/search`, …). Write tools call Reddit's OAuth API (`oauth.reddit.com`) using a token minted from your credentials and cached in memory until just before expiry. Nothing is written to disk.

## Responsible use

This project leans on [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift), a free service run by one developer. Please be a good citizen:

- Don't hammer it on every page-load of a busy app — **cache results** in your own store and refresh on a schedule.
- Keep a descriptive `ARCTIC_SHIFT_USER_AGENT`.
- Respect its rate limit (the server surfaces HTTP 429 clearly so you can back off).
- To remove your own Reddit data from the archive, use Arctic Shift's [removal form](https://docs.google.com/forms/d/e/1FAIpQLSfzkmE8Bg6K_xii7aRm66ljzvo2tR59lTsdJ99acW4WX786Vw/viewform).

Huge thanks to Arthur Heitmann for keeping Reddit data accessible.

## Development

```bash
npm install        # installs deps and builds (via prepare)
npm run build      # tsc -> dist/
npm test           # unit tests (node --test)
npm run dev        # watch mode
```

## License

[MIT](./LICENSE) © Kevsosmooth
