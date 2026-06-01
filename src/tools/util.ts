/** Shared helpers for tool handlers. */

export function ok(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

/** Run an async producer, returning ok(result) or a clean fail() on throw. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** Map a friendly sort to the Arctic Shift created_utc direction. */
export function mapSort(sort: "new" | "old" | undefined): "asc" | "desc" {
  return sort === "old" ? "asc" : "desc";
}
