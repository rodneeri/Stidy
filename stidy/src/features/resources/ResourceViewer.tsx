"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Download } from "lucide-react";
import type { Resource } from "@/types/db";
import { Portal } from "@/components/ui/Portal";

interface Props {
  resource: Resource | null;
  url: string | null;
  onClose: () => void;
}

/** Full-screen in-app viewer for PDFs, images and video. */
export function ResourceViewer({ resource, url, onClose }: Props) {
  const mime = resource?.mime_type ?? "";
  const isPdf = mime === "application/pdf";
  const isImg = mime.startsWith("image/");
  const isVid = mime.startsWith("video/");

  return (
    <Portal>
    <AnimatePresence>
      {resource && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="glass relative z-10 flex h-[86vh] w-[min(960px,94vw)] flex-col overflow-hidden p-0"
          >
            <header className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
              <p className="min-w-0 flex-1 truncate font-medium">{resource.title}</p>
              {url && (
                <>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open in new tab"
                    className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={url}
                    download={resource.title}
                    aria-label="Download"
                    className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-primary"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid flex-1 place-items-center overflow-auto bg-black/20">
              {!url ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : isPdf ? (
                <iframe src={url} title={resource.title} className="h-full w-full" />
              ) : isImg ? (
                <img src={url} alt={resource.title} className="max-h-full max-w-full object-contain" />
              ) : isVid ? (
                <video src={url} controls className="max-h-full max-w-full" />
              ) : (
                <div className="space-y-3 p-8 text-center">
                  <p className="text-sm text-muted">
                    This file type can&apos;t be previewed inline.
                  </p>
                  <a href={url} download={resource.title} className="neu-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    <Download className="h-4 w-4" /> Download
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
