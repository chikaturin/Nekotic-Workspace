"use client";

import { motion } from "framer-motion";
import { ArrowRight, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useCreateBoard } from "@/hooks/use-create-board";
import { requirementFor } from "@/lib/permissions";
import { BOARD_TEMPLATES } from "@/lib/board-templates";

/**
 * A workspace with nothing in it yet (SY-DSH-44).
 *
 * Three empty widgets tell a new team nothing. The first thing they need is a
 * board with a task on it, so that is the only thing this offers — and it is
 * still permission-gated, because a viewer cannot create one.
 */
export function OnboardingPanel() {
  const { createBoard, isCreating } = useCreateBoard();
  const can = usePermissions();
  const canCreate = can("board.create");
  const taskTemplate = BOARD_TEMPLATES.find((template) => template.id === "task") ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-8 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-xl border border-accent/30 bg-accent-soft">
        <Sparkles className="size-5 text-accent" strokeWidth={1.5} />
      </span>

      <div className="space-y-1.5">
        <h2 className="text-title font-semibold tracking-tight text-foreground">
          Nothing to report yet
        </h2>
        <p className="text-lead text-muted-foreground">
          The dashboard reads your boards. Start one and its first task will show
          up here as soon as it has a status.
        </p>
      </div>

      <Button
        size="sm"
        variant="default"
        className="gap-1.5"
        disabled={!canCreate || isCreating || taskTemplate === null}
        title={canCreate ? undefined : requirementFor("board.create")}
        onClick={() => taskTemplate && createBoard(null, taskTemplate)}
      >
        <ListChecks />
        Create your first task board
        <ArrowRight />
      </Button>

      {!canCreate && (
        <p className="text-body text-faint-foreground">{requirementFor("board.create")}</p>
      )}
    </motion.section>
  );
}
