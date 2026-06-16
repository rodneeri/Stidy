import { AppError } from "@/lib/errors";

/**
 * fetch + JSON, hardened.
 *
 * The classic STiDY crash was `await res.json()` on a response that wasn't JSON
 * (a platform timeout page reading "An error occurred…"), which threw the opaque
 * `Unexpected token 'A'` SyntaxError. This helper reads the body as text exactly
 * once, then:
 *   - on a non-OK status, throws an {@link AppError} carrying the server's real
 *     message (parsed from JSON `{error}` when possible, else the raw text);
 *   - on an OK status that isn't valid JSON, throws an AppError with the raw body
 *     instead of a cryptic parse error;
 *   - otherwise returns the parsed JSON.
 *
 * Callers get a structured error they can hand straight to the Error Center.
 */
export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit,
  opts?: { title?: string },
): Promise<T> {
  const title = opts?.title ?? "Request failed";
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (networkErr) {
    throw new AppError({
      title,
      status: 0,
      source: input,
      systemMessage:
        networkErr instanceof Error ? networkErr.message : String(networkErr),
    });
  }

  const text = await res.text();
  let parsed: unknown;
  let isJson = true;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    isJson = false;
  }

  if (!res.ok) {
    const serverMsg =
      isJson && parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : text || res.statusText;
    throw new AppError({
      title,
      status: res.status,
      source: input,
      systemMessage: `HTTP ${res.status} ${res.statusText}\n\n${serverMsg}`,
    });
  }

  if (!isJson) {
    throw new AppError({
      title,
      status: res.status,
      source: input,
      systemMessage: `Expected JSON but the server returned:\n\n${
        text.slice(0, 2000) || "(empty response)"
      }`,
      hint: "This usually means the server timed out or crashed before replying. For AI generation, try fewer questions or an easier difficulty.",
    });
  }

  return parsed as T;
}
