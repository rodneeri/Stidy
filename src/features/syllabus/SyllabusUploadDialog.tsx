"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  importing: boolean;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

/** Drag-and-drop / click-to-upload dialog for syllabus AI import. */
export function SyllabusUploadDialog({ open, onClose, onFile, importing }: Props) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (importing) return;
    setFile(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Import syllabus">
      <p className="mb-4 text-sm text-muted">
        Drop a syllabus PDF or image — AI reads it and builds the grading structure (categories
        and sub-gradings) for you.
      </p>

      <div
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
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={cn(
          "neu-inset flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center outline-none transition-all",
          drag && "ring-2 ring-primary",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.currentTarget.value = "";
          }}
        />
        {file ? (
          <>
            <FileText className="h-9 w-9 text-primary" />
            <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted">Click to choose a different file</p>
          </>
        ) : (
          <>
            <UploadCloud className={cn("h-9 w-9", drag ? "text-primary" : "text-muted")} />
            <p className="text-sm font-medium">Drag &amp; drop, or click to upload</p>
            <p className="text-xs text-muted">PDF, PNG, JPG · max 15 MB</p>
          </>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={importing}
          className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => file && onFile(file)}
          disabled={!file || importing}
          className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {importing ? "Parsing…" : "Parse with AI"}
        </button>
      </div>
    </Modal>
  );
}
