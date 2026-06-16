"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Copy, X, ScrollText } from "lucide-react";
import { spring } from "@/lib/motion";
import { Portal } from "@/components/ui/Portal";
import { useErrorStore, type ReportedError } from "@/stores/error-store";

function formatReport(e: ReportedError): string {
  return [
    `STiDY error report`,
    `time: ${new Date(e.at).toISOString()}`,
    e.source ? `source: ${e.source}` : null,
    e.status !== undefined ? `status: ${e.status}` : null,
    `title: ${e.title}`,
    ``,
    `--- system message ---`,
    e.systemMessage,
    ``,
    `--- what to do ---`,
    e.hint,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Global Error Center. Mounted once near the app root; it:
 *  - installs window-level `error` / `unhandledrejection` listeners so even
 *    uncaught failures surface in a popup instead of vanishing into the console;
 *  - renders the currently-active error from the error store on top of
 *    everything (z-100, above modals) with the true system log + a fix hint.
 */
export function ErrorCenter() {
  const { active, log, report, dismiss, clear } = useErrorStore();
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Surface uncaught errors + promise rejections globally.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (e.error) report(e.error, "window.onerror");
      else
        report(
          { message: e.message },
          `window.onerror (${e.filename}:${e.lineno})`,
        );
    };
    const onRejection = (e: PromiseRejectionEvent) =>
      report(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);

  useEffect(() => {
    setCopied(false);
    setShowLog(false);
  }, [active?.id]);

  async function copy() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(formatReport(active));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  return (
    <Portal>
      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={dismiss}
              aria-hidden
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-label={active.title}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={spring.pop}
              className="glass relative z-10 flex w-full max-w-lg flex-col gap-4 p-6"
            >
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="pressable absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-3 pr-8">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {active.title}
                  </h2>
                  <p className="text-xs text-muted">
                    {active.source ? `${active.source} · ` : ""}
                    {active.status !== undefined
                      ? `status ${active.status} · `
                      : ""}
                    {new Date(active.at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* True system message / log */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  System message
                </p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 font-mono text-xs leading-relaxed text-foreground/90">
                  {active.systemMessage}
                </pre>
              </div>

              {/* What to do */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  What to do
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {active.hint}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="pressable inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy report"}
                </button>
                {log.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowLog((v) => !v)}
                    className="pressable inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
                  >
                    <ScrollText className="h-4 w-4" />
                    {showLog ? "Hide" : `Error log (${log.length})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={dismiss}
                  className="pressable ml-auto rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                >
                  Dismiss
                </button>
              </div>

              {showLog && (
                <div className="max-h-40 overflow-auto rounded-xl border border-white/10">
                  {log.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => useErrorStore.getState().show(e.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-white/5 ${
                        e.id === active.id ? "bg-white/5" : ""
                      }`}
                    >
                      <span className="truncate">{e.title}</span>
                      <span className="shrink-0 text-muted">
                        {new Date(e.at).toLocaleTimeString()}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clear}
                    className="w-full px-3 py-2 text-left text-xs text-muted hover:bg-white/5"
                  >
                    Clear log
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
