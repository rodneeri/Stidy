"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Shuffle, Pencil, ArrowLeft, Layers, RotateCw, Check } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Portal } from "@/components/ui/Portal";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { Flashcard } from "@/types/db";
import { cn } from "@/lib/utils";

function shuffleArr<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Drop duplicate ids — duplicate keys can crash AnimatePresence mid-study. */
function uniqById(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

interface Props {
  cards: Flashcard[];
  onUpdate: (id: string, front: string, back: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onDeleteAll: () => Promise<void> | void;
}

export function FlashcardStack({ cards, onUpdate, onDelete, onDeleteAll }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"shuffle" | "study">("shuffle");
  const [order, setOrder] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);

  const launch = () => {
    setOrder(shuffleArr(uniqById(cards)));
    setFlipped(false);
    setEditing(false);
    setPhase("shuffle");
    setOpen(true);
    setTimeout(() => setPhase("study"), 1200);
  };
  const reshuffle = () => {
    setFlipped(false);
    setPhase("shuffle");
    setOrder((o) => shuffleArr(o));
    setTimeout(() => setPhase("study"), 1000);
  };
  const next = () => {
    setFlipped(false);
    setOrder((o) => (o.length > 1 ? [...o.slice(1), o[0]] : o));
  };

  const top = order[0];
  const depth = Math.min(order.length - 1, 2);

  return (
    <>
      {/* Collapsed stack — click to study */}
      <button
        onClick={launch}
        className="group relative mx-auto block h-44 w-72"
        aria-label="Study flashcards"
      >
        {[3, 2, 1].slice(0, Math.min(cards.length - 1, 3)).map((i) => (
          <div
            key={i}
            className="glass absolute inset-0 transition-transform group-hover:translate-y-0"
            style={{ transform: `translateY(${i * 5}px) rotate(${(i % 2 ? 1 : -1) * (i * 0.8)}deg)`, opacity: 1 - i * 0.12 }}
          />
        ))}
        <div className="glass absolute inset-0 flex flex-col p-4 transition-transform group-hover:-translate-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Tap to study</span>
          <p className="mt-1 line-clamp-3 text-sm font-semibold">
            <MathText>{cards[0]?.front ?? ""}</MathText>
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-xs text-muted">
            <Layers className="h-3.5 w-3.5" /> {cards.length} cards
          </span>
        </div>
      </button>

      <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="glass flex w-full max-w-lg flex-col gap-4 p-5"
            >
              {/* header */}
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="flex-1 font-semibold">{editing ? "Edit cards" : "Flashcards"}</p>
                {!editing && (
                  <>
                    <button onClick={reshuffle} className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-primary" aria-label="Shuffle">
                      <Shuffle className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(true)} className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-primary" aria-label="Edit cards">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <ConfirmDelete
                      label="Delete whole stack"
                      onConfirm={async () => {
                        await onDeleteAll();
                        setOpen(false);
                      }}
                    />
                  </>
                )}
                {editing && (
                  <button onClick={() => setEditing(false)} className="pressable flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground" aria-label="Exit">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ErrorBoundary
                fallback={
                  <p className="py-10 text-center text-sm text-muted">
                    This deck hit a snag rendering. Close and reopen, or reshuffle.
                  </p>
                }
              >
              {editing ? (
                <EditList cards={cards} onUpdate={onUpdate} onDelete={onDelete} />
              ) : phase === "shuffle" ? (
                <ShuffleAnim count={Math.min(order.length, 5)} />
              ) : top ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-72 w-full" style={{ perspective: 1400 }}>
                    {/* depth cards behind */}
                    {Array.from({ length: depth }, (_, i) => (
                      <div
                        key={i}
                        className="glass absolute inset-0"
                        style={{ transform: `translateY(${(i + 1) * 6}px) scale(${1 - (i + 1) * 0.03})`, opacity: 0.6 - i * 0.2 }}
                      />
                    ))}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={top.id}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ x: -340, rotate: -14, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="absolute inset-0 cursor-pointer"
                        onClick={() => setFlipped((f) => !f)}
                      >
                        <motion.div
                          className="relative h-full w-full"
                          style={{ transformStyle: "preserve-3d" }}
                          animate={{ rotateY: flipped ? 180 : 0 }}
                          transition={{ type: "spring", stiffness: 260, damping: 26 }}
                        >
                          <div className="glass absolute inset-0 grid place-items-center p-6 text-center" style={{ backfaceVisibility: "hidden" }}>
                            <div>
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">Question</p>
                              <p className="text-lg font-semibold"><MathText>{top.front}</MathText></p>
                            </div>
                          </div>
                          <div className="glass absolute inset-0 grid place-items-center overflow-auto p-6 text-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                            <div>
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">Answer</p>
                              <p className="text-base"><MathText>{top.back}</MathText></p>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setFlipped((f) => !f)} className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium">
                      <RotateCw className="h-4 w-4" /> Flip
                    </button>
                    <button onClick={next} className="neu-btn px-5 py-2 text-sm font-medium text-primary">
                      Next →
                    </button>
                  </div>
                  <p className="text-xs text-muted">Tap the card to flip · Next sends it to the back</p>
                </div>
              ) : null}
              </ErrorBoundary>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </Portal>
    </>
  );
}

/** Brief riffle animation before studying. */
function ShuffleAnim({ count }: { count: number }) {
  return (
    <div className="grid h-72 w-full place-items-center">
      <div className="relative h-44 w-72">
        {Array.from({ length: Math.max(count, 3) }, (_, i) => (
          <motion.div
            key={i}
            className="glass absolute inset-0"
            initial={{ x: 0, rotate: 0 }}
            animate={{ x: [0, (i % 2 ? 1 : -1) * (40 + i * 14), 0], rotate: [0, (i % 2 ? 1 : -1) * (8 + i * 3), 0] }}
            transition={{ duration: 1.1, ease: "easeInOut", delay: i * 0.05 }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-muted">
          Shuffling…
        </div>
      </div>
    </div>
  );
}

/** Inline editor for every card in the deck. */
function EditList({
  cards,
  onUpdate,
  onDelete,
}: {
  cards: Flashcard[];
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}) {
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
      {cards.map((c) => (
        <EditRow key={c.id} card={c} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

function EditRow({
  card,
  onUpdate,
  onDelete,
}: {
  card: Flashcard;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saved, setSaved] = useState(false);
  const dirty = front !== card.front || back !== card.back;
  const ta = "field w-full resize-none rounded-lg px-3 py-2 text-sm outline-none";

  return (
    <div className="neu-inset space-y-2 rounded-xl p-3">
      <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className={ta} placeholder="Question" />
      <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} className={ta} placeholder="Answer" />
      <div className="flex items-center justify-end gap-2">
        <ConfirmDelete label="Delete card" onConfirm={() => onDelete(card.id)} />
        <button
          disabled={!dirty}
          onClick={async () => {
            await onUpdate(card.id, front, back);
            setSaved(true);
            setTimeout(() => setSaved(false), 1200);
          }}
          className={cn(
            "pressable flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium",
            dirty ? "text-primary" : "text-muted",
          )}
        >
          {saved && <Check className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
