"use client";

import { motion } from "framer-motion";
import { Hammer, Map, Sparkles, CheckCircle2 } from "lucide-react";
import { reveal, dur, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  ROADMAP,
  STATUS_ORDER,
  STATUS_LABEL,
  type RoadmapStatus,
} from "@/components/marketing/roadmap-data";

const STATUS_ICON: Record<RoadmapStatus, React.ComponentType<{ className?: string }>> = {
  "in-progress": Hammer,
  planned: Map,
  exploring: Sparkles,
  shipped: CheckCircle2,
};

const STATUS_STYLE: Record<RoadmapStatus, string> = {
  "in-progress": "bg-primary/15 text-primary",
  planned: "bg-secondary/15 text-secondary",
  exploring: "bg-accent/15 text-accent",
  shipped: "bg-success/15 text-success",
};

/**
 * "Under Development" / Roadmap section. Purely a renderer — all editable
 * content lives in `roadmap-data.ts` (see the comment at the top of that
 * file for how to add/remove/reorder items). This component never needs to
 * change for a routine content update.
 */
export function RoadmapSection() {
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: ROADMAP.filter((item) => item.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <section id="roadmap" className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
      <motion.div
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-12% 0px" }}
        className="text-center"
      >
        <span className="eyebrow">Under development</span>
        <h2 className="display-2 mx-auto mt-3 max-w-2xl font-display font-bold tracking-tight">
          Built in the open, shipped on the regular.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Here is exactly what we&apos;re building next. This list updates the moment we change one
          file — nothing here is stale marketing copy.
        </p>
      </motion.div>

      <div className="mt-12 flex flex-col gap-10">
        {grouped.map((group, gi) => (
          <div key={group.status}>
            <motion.div
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ delay: gi * 0.05 }}
              className="mb-4 flex items-center gap-2"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  STATUS_STYLE[group.status],
                )}
              >
                {STATUS_LABEL[group.status]}
              </span>
              <span className="h-px flex-1 bg-border" />
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
              {group.items.map((item, i) => {
                const Icon = STATUS_ICON[item.status];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-10% 0px" }}
                    transition={{ duration: dur.slow, delay: (i % 2) * 0.07, ease: easeOut }}
                    className="glass flex flex-col gap-3 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                          STATUS_STYLE[item.status],
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      {item.eta && (
                        <span className="neu-inset shrink-0 rounded-full px-3 py-1 text-xs text-muted">
                          {item.eta}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold tracking-tight">{item.title}</h3>
                    <p className="text-sm text-muted">{item.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
