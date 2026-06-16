/**
 * App-wide error model.
 *
 * Every error that reaches the user is normalised into an {@link AppError} so the
 * global Error Center (see `components/shared/ErrorCenter.tsx`) can always show
 * three things: a human title, the *true* system message/log, and a "what to do"
 * hint. Nothing should ever surface a bare `JSON.parse` exception again.
 */

export interface AppErrorInit {
  /** Short human-readable headline, e.g. "Couldn't generate your exam". */
  title: string;
  /** The raw system message / server text / stack — shown verbatim in the log. */
  systemMessage: string;
  /** Actionable "what to do" guidance for the user. */
  hint?: string;
  /** HTTP status when the error came from a fetch (0 = network/timeout). */
  status?: number;
  /** Where it happened — endpoint path or feature name. */
  source?: string;
}

export class AppError extends Error {
  title: string;
  systemMessage: string;
  hint: string;
  status?: number;
  source?: string;

  constructor(init: AppErrorInit) {
    super(init.title);
    this.name = "AppError";
    this.title = init.title;
    this.systemMessage = init.systemMessage;
    this.hint = init.hint ?? defaultHint(init.status);
    this.status = init.status;
    this.source = init.source;
  }
}

/** Best-effort actionable guidance derived from an HTTP status. */
export function defaultHint(status?: number): string {
  switch (true) {
    case status === undefined:
      return "Something went wrong in the app. Try the action again — if it keeps happening, copy this report and send it to support.";
    case status === 0:
      return "The request couldn't reach the server, or it timed out. Check your connection and try again. For AI generation, try fewer questions or an easier difficulty.";
    case status === 401:
      return "Your session expired. Sign out and sign back in, then retry.";
    case status === 403:
      return "You don't have permission for this. If this is your data, sign in again or contact an admin.";
    case status === 404:
      return "That resource no longer exists. Refresh the page and try again.";
    case status === 408 || status === 504:
      return "The server took too long to respond — usually an AI request that ran over its time limit. Try fewer questions, an easier difficulty, or a different model in Settings.";
    case status === 413:
      return "The upload is too large. Try a smaller file.";
    case status === 429:
      return "You're sending requests too quickly, or an AI rate limit was hit. Wait a minute and try again.";
    case typeof status === "number" && status >= 500:
      return "The server hit an unexpected error. Wait a moment and retry. If it persists, copy this report and send it to support.";
    default:
      return "Try the action again. If it keeps failing, copy this report and send it to support.";
  }
}

/** Normalise anything thrown into an AppError so the UI always has full fields. */
export function toAppError(err: unknown, source?: string): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError({
      title: "Something went wrong",
      systemMessage: `${err.name}: ${err.message}${err.stack ? `\n\n${err.stack}` : ""}`,
      source,
    });
  }
  return new AppError({
    title: "Something went wrong",
    systemMessage: typeof err === "string" ? err : JSON.stringify(err),
    source,
  });
}
