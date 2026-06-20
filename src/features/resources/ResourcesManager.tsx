"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import {
  UploadCloud,
  Loader2,
  FileText,
  Folder,
  ChevronDown,
  Sparkles,
  GripVertical,
  Pencil,
  ExternalLink,
  Filter,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Resource, ResourceKind } from "@/types/db";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Dropdown, type Option } from "@/components/ui/Dropdown";
import { ResourceViewer } from "@/features/resources/ResourceViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Portal } from "@/components/ui/Portal";
import { SubjectIcon } from "@/components/ui/SubjectIcon";
import { FadeIn } from "@/components/motion/FadeIn";
import { cn } from "@/lib/utils";

const KINDS: ResourceKind[] = ["theory", "practice", "exam", "admin", "other"];
const KIND_STYLE: Record<ResourceKind, string> = {
  theory: "bg-secondary/15 text-secondary",
  practice: "bg-success/15 text-success",
  exam: "bg-danger/15 text-danger",
  admin: "bg-warning/15 text-warning",
  other: "bg-foreground/10 text-muted",
};
const KIND_OPTS: Option[] = KINDS.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }));

const VISION = (f: File) =>
  (f.type === "application/pdf" || f.type.startsWith("image/")) && f.size < 10 * 1024 * 1024;

function fmtBytes(n: number | null) {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

type Flight = { id: string; x0: number; y0: number; x1: number; y1: number };

/** A draggable, compact file row — drag the grip to fling it into another folder. */
function FileRow({
  r,
  subjectOpts,
  onReassign,
  onCategory,
  onRename,
  onOpen,
  onDelete,
  onDrop,
}: {
  r: Resource;
  subjectOpts: Option[];
  onReassign: (id: string, subjectId: string) => void;
  onCategory: (id: string, kind: ResourceKind) => void;
  onRename: (id: string, title: string) => void;
  onOpen: (r: Resource) => void;
  onDelete: (r: Resource) => void;
  onDrop: (r: Resource, x: number, y: number) => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.title);

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0.2}
      whileDrag={{ scale: 1.03, zIndex: 50, cursor: "grabbing" }}
      onDragEnd={(_e, info) => onDrop(r, info.point.x, info.point.y)}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className="glass flex items-center gap-2 px-2.5 py-1.5"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="shrink-0 cursor-grab touch-none text-muted hover:text-foreground"
        aria-label="Drag to another subject"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (name.trim() && name !== r.title) onRename(r.id, name.trim());
            else setName(r.title);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="field min-w-0 flex-1 rounded-lg px-2 py-0.5 text-sm outline-none"
        />
      ) : (
        <button onClick={() => onOpen(r)} className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {r.title}
        </button>
      )}
      {r.size_bytes ? (
        <span className="hidden shrink-0 text-[11px] tabular-nums text-muted sm:inline">{fmtBytes(r.size_bytes)}</span>
      ) : null}

      <button
        onClick={() => setEditing(true)}
        aria-label="Rename"
        className="pressable hidden h-6 w-6 shrink-0 place-items-center rounded-lg text-muted hover:text-primary sm:grid"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <Dropdown
        value={r.kind}
        options={KIND_OPTS}
        onChange={(v) => onCategory(r.id, v as ResourceKind)}
        className="hidden w-24 shrink-0 sm:block"
        up
      />
      <Dropdown
        value={r.subject_id ?? ""}
        options={subjectOpts}
        onChange={(v) => onReassign(r.id, v)}
        className="hidden w-32 shrink-0 md:block"
        up
      />
      <button
        onClick={() => onOpen(r)}
        aria-label="Open"
        className="pressable grid h-6 w-6 shrink-0 place-items-center rounded-lg text-muted hover:text-primary"
      >
        <ExternalLink className="h-3 w-3" />
      </button>
      <ConfirmDelete label="Delete resource" onConfirm={() => onDelete(r)} />
    </motion.div>
  );
}

export function ResourcesManager({ initialSubject = null }: { initialSubject?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<Resource | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);

  // Filters
  const [fSubject, setFSubject] = useState("");
  const [fKind, setFKind] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const folderRefs = useRef<Map<string, HTMLElement>>(new Map());

  async function load() {
    const [{ data: res }, { data: subs }] = await Promise.all([
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
      supabase.from("subjects").select("id, name, color").is("parent_id", null).order("name"),
    ]);
    setResources((res as Resource[]) ?? []);
    setSubjects((subs as { id: string; name: string; color: string | null }[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await load();
      if (initialSubject) {
        setExpanded(new Set([initialSubject]));
        setSettled(new Set([initialSubject]));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const hasSubjects = subjects.length > 0;
  const subjectOpts: Option[] = [
    { value: "", label: "Unassigned" },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  function fly(targetKey: string) {
    const from = uploadRef.current?.getBoundingClientRect();
    const to = folderRefs.current.get(targetKey)?.getBoundingClientRect();
    if (!from || !to) return;
    setFlights((f) => [
      ...f,
      {
        id: crypto.randomUUID(),
        x0: from.left + from.width / 2,
        y0: from.top + from.height / 2,
        x1: to.left + to.width / 2,
        y1: to.top + 28,
      },
    ]);
  }

  async function classify(file: File) {
    const names = subjects.map((s) => s.name);
    try {
      let res: Response;
      if (VISION(file)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("subjects", JSON.stringify(names));
        res = await fetch("/api/resources/classify", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/resources/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, subjects: names }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        if (j?.error) setError(j.error);
        return null;
      }
      return (await res.json()) as { kind: ResourceKind; title: string; summary: string | null; subject: string | null };
    } catch {
      return null;
    }
  }

  async function handleFiles(files: File[]) {
    if (!userId || files.length === 0) return;
    setError(null);
    for (const file of files) {
      setBusy(`Uploading ${file.name}…`);
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("resources").upload(path, file);
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      setBusy(`Recognising ${file.name}…`);
      const c = await classify(file);
      const matched = c?.subject ? subjects.find((s) => s.name === c.subject) ?? null : null;
      const { error: insErr } = await supabase.from("resources").insert({
        user_id: userId,
        subject_id: matched?.id ?? null,
        title: file.name,
        kind: c?.kind ?? "other",
        source: "upload",
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        meta: c?.summary ? { summary: c.summary } : {},
      });
      if (insErr) {
        setError(insErr.message);
        continue;
      }
      fly(matched?.id ?? "none");
    }
    setBusy(null);
    await load();
  }

  async function view(r: Resource) {
    setViewing(r);
    setViewUrl(null);
    if (r.storage_path) {
      const { data } = await supabase.storage.from("resources").createSignedUrl(r.storage_path, 3600);
      setViewUrl(data?.signedUrl ?? null);
    }
  }
  async function remove(r: Resource) {
    if (r.storage_path) await supabase.storage.from("resources").remove([r.storage_path]);
    await supabase.from("resources").delete().eq("id", r.id);
    await load();
  }
  async function reassign(id: string, subjectId: string) {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, subject_id: subjectId || null } : r)));
    await supabase.from("resources").update({ subject_id: subjectId || null }).eq("id", id);
  }
  async function setCategory(id: string, kind: ResourceKind) {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, kind } : r)));
    await supabase.from("resources").update({ kind }).eq("id", id);
  }
  async function rename(id: string, title: string) {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, title } : r)));
    await supabase.from("resources").update({ title }).eq("id", id);
  }

  // Drag-drop a file onto another folder → reassign its subject (with a little fly).
  function onFileDrop(r: Resource, x: number, y: number) {
    for (const [key, el] of folderRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const target = key === "none" ? "" : key;
        if ((target || null) !== r.subject_id) reassign(r.id, target);
        return;
      }
    }
  }

  function toggle(key: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) {
        n.delete(key);
        setSettled((st) => {
          const m = new Set(st);
          m.delete(key);
          return m;
        });
      } else {
        n.add(key);
      }
      return n;
    });
  }

  const filtered = resources.filter((r) => {
    if (fSubject === "none" && r.subject_id) return false;
    if (fSubject && fSubject !== "none" && r.subject_id !== fSubject) return false;
    if (fKind && r.kind !== fKind) return false;
    return true;
  });

  const bySubject = new Map<string, Resource[]>();
  for (const r of filtered) {
    const k = r.subject_id ?? "none";
    (bySubject.get(k) ?? bySubject.set(k, []).get(k)!).push(r);
  }
  const folders = [
    ...subjects.map((s) => ({ key: s.id, name: s.name, color: s.color ?? "#14b8a6", items: bySubject.get(s.id) ?? [] })),
    ...(bySubject.get("none")?.length
      ? [{ key: "none", name: "Unassigned", color: "#94a3b8", items: bySubject.get("none")! }]
      : []),
  ].filter((f) => !fSubject || f.key === fSubject || (fSubject === "none" && f.key === "none"));

  const filterSubjectOpts: Option[] = [
    { value: "", label: "All subjects" },
    ...subjects.filter((s) => resources.some((r) => r.subject_id === s.id)).map((s) => ({ value: s.id, label: s.name })),
    ...(resources.some((r) => !r.subject_id) ? [{ value: "none", label: "Unassigned" }] : []),
  ];
  const presentKinds = new Set(resources.map((r) => r.kind));
  const filterKindOpts: Option[] = [
    { value: "", label: "All types" },
    ...KIND_OPTS.filter((o) => presentKinds.has(o.value as ResourceKind)),
  ];
  const filtersActive = !!(fSubject || fKind);

  if (loading) return null;

  return (
    <FadeIn className="space-y-6">
      <header>
        <h1 className="display-3">Resources</h1>
        <p className="mt-1 text-sm text-muted">
          Drop files to auto-file them. Drag a file by its grip to move it to another subject.
        </p>
      </header>

      {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Dropzone */}
      <div
        ref={uploadRef}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "neu-inset cursor-pointer rounded-2xl outline-none transition-all",
          drag && "ring-2 ring-primary",
          hasSubjects ? "flex items-center gap-3 p-4" : "flex flex-col items-center justify-center gap-3 p-8 text-center",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.currentTarget.value = "";
          }}
        />
        {busy ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium">{busy}</p>
          </>
        ) : hasSubjects ? (
          <>
            <UploadCloud className={cn("h-6 w-6", drag ? "text-primary" : "text-muted")} />
            <p className="text-sm font-medium">Drop files to upload &amp; auto-file</p>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted">
              <Sparkles className="h-3 w-3" /> AI sorts by subject &amp; type
            </span>
          </>
        ) : (
          <>
            <UploadCloud className={cn("h-8 w-8", drag ? "text-primary" : "text-muted")} />
            <p className="text-sm font-medium">Drag &amp; drop files, or click to upload</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Sparkles className="h-3 w-3" /> PDFs &amp; images are read &amp; auto-classified
            </p>
          </>
        )}
      </div>

      {/* Filters */}
      {resources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <Dropdown value={fSubject} options={filterSubjectOpts} onChange={setFSubject} className="w-40" />
          <Dropdown value={fKind} options={filterKindOpts} onChange={setFKind} className="w-36" />
          {filtersActive && (
            <button
              onClick={() => {
                setFSubject("");
                setFKind("");
              }}
              className="pressable flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-primary"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {!hasSubjects ? (
        filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No resources yet">
            Drop a file above and STiDY will auto-file it by type and subject.
          </EmptyState>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((r) => (
              <FileRow
                key={r.id}
                r={r}
                subjectOpts={subjectOpts}
                onReassign={reassign}
                onCategory={setCategory}
                onRename={rename}
                onOpen={view}
                onDelete={remove}
                onDrop={onFileDrop}
              />
            ))}
          </div>
        )
      ) : folders.length === 0 ? (
        <EmptyState icon={<Filter className="h-6 w-6" />} title="Nothing matches">
          Try clearing the filters above.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => {
            const isOpen = expanded.has(folder.key);
            const byKind = KINDS.map((k) => ({ k, items: folder.items.filter((r) => r.kind === k) })).filter(
              (g) => g.items.length,
            );
            return (
              <div
                key={folder.key}
                ref={(el) => {
                  if (el) folderRefs.current.set(folder.key, el);
                }}
                className="glass p-0"
              >
                <button onClick={() => toggle(folder.key)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
                  {folder.key === "none" ? (
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: folder.color }}
                    >
                      <Folder className="h-4 w-4" />
                    </span>
                  ) : (
                    <SubjectIcon id={folder.key} color={folder.color} size="md" className="h-8 w-8 rounded-lg text-base" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{folder.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {byKind.length ? (
                        byKind.map(({ k, items }) => (
                          <span
                            key={k}
                            className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", KIND_STYLE[k])}
                          >
                            {k} {items.length}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted">Empty</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{folder.items.length}</span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      onAnimationComplete={() =>
                        setSettled((s) => new Set(s).add(folder.key))
                      }
                      style={{ overflow: settled.has(folder.key) ? "visible" : "hidden" }}
                    >
                      <div className="space-y-1.5 border-t border-border/60 p-2.5">
                        {folder.items.length === 0 ? (
                          <p className="p-2 text-sm text-muted">No documents yet.</p>
                        ) : (
                          folder.items.map((r) => (
                            <FileRow
                              key={r.id}
                              r={r}
                              subjectOpts={subjectOpts}
                              onReassign={reassign}
                              onCategory={setCategory}
                              onRename={rename}
                              onOpen={view}
                              onDelete={remove}
                              onDrop={onFileDrop}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <Portal>
        {flights.map((f) => (
          <motion.div
            key={f.id}
            className="pointer-events-none fixed left-0 top-0 z-[60]"
            initial={{ x: f.x0, y: f.y0, scale: 1, opacity: 0.95 }}
            animate={{ x: f.x1, y: f.y1, scale: 0.2, opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => setFlights((s) => s.filter((x) => x.id !== f.id))}
          >
            <div className="grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-[var(--shadow-glow)]">
              <FileText className="h-5 w-5" />
            </div>
          </motion.div>
        ))}
      </Portal>

      <ResourceViewer resource={viewing} url={viewUrl} onClose={() => setViewing(null)} />
    </FadeIn>
  );
}
