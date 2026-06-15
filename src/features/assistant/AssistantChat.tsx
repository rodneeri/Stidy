"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Send, X, Loader2, AlertTriangle } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Dropdown } from "@/components/ui/Dropdown";
import { NVIDIA_MODELS } from "@/lib/ai/catalog";
import { useAiModel } from "@/lib/ai/useAiModel";
import { onAskAssistant } from "@/features/assistant/assistant-bus";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = NVIDIA_MODELS.map((m) => ({ value: m.value, label: m.label }));

type Msg = { role: "user" | "assistant"; content: string; model?: string };

/**
 * The answer label is "NVIDIA · …" when your picked model replied, or
 * "Gemini · …" / "Groq · …" when NVIDIA was busy and it fell back. Fallback
 * providers are less capable, so we warn when one answered.
 */
const isFallbackModel = (label?: string) => !!label && !label.startsWith("NVIDIA");

const SUGGESTIONS = [
  "When is my next exam and what % of the grade is it?",
  "What do I need on my final to pass?",
  "What's due this week?",
];

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useAiModel();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, model }),
      });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.ok ? json.text : json.error ?? "Something went wrong.",
          model: res.ok ? json.model : undefined,
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setSending(false);
    }
  }

  // Let the top-bar search (or anywhere) open this panel and ask a question.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(
    () =>
      onAskAssistant((q) => {
        setOpen(true);
        sendRef.current(q);
      }),
    [],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask STiDY"
        className="neu-btn fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full text-primary"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="glass fixed bottom-6 right-6 z-50 flex h-[72vh] w-[min(420px,92vw)] flex-col overflow-hidden p-0"
          >
            <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="font-semibold">Ask STiDY</p>
              <Dropdown
                value={model}
                options={MODEL_OPTIONS}
                onChange={setModel}
                className="ml-auto w-36"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="space-y-3 text-sm text-muted">
                  <p>Hi! I know your subjects, grades, deadlines and materials. Try asking:</p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="neu-inset block w-full rounded-lg px-3 py-2 text-left text-xs hover:text-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "neu-inset",
                    )}
                  >
                    <MathText>{m.content}</MathText>
                  </div>
                  {m.model &&
                    (isFallbackModel(m.model) ? (
                      <p className="mt-1 flex items-start gap-1 px-1 text-[10px] font-medium text-warning">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                        <span>
                          Fallback · {m.model} — your NVIDIA pick was busy, so a less-capable model
                          answered. Retry in a moment for the full model.
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 px-1 text-[10px] text-muted">via {m.model}</p>
                    ))}
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="neu-inset rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Ask about your semester…"
                className="field flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="neu-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl text-primary disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
