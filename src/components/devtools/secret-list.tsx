"use client";

import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { environmentOption } from "@/components/devtools/environment-picker";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import type { SecretController } from "@/hooks/use-secret-document";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SecretDocument, SecretEntry } from "@/types";

interface SecretListProps {
  readonly document: SecretDocument;
  readonly controller: SecretController;
  readonly canReveal: boolean;
}

export function SecretList({ document, controller, canReveal }: SecretListProps) {
  const [selected, setSelected] = useState<readonly string[]>([]);

  const chosen = useMemo(() => new Set(selected), [selected]);

  const live = useMemo(
    () => selected.filter((id) => document.entries.some((entry) => entry.id === id)),
    [selected, document.entries],
  );

  const isAllSelected = live.length === document.entries.length && document.entries.length > 0;

  function toggle(secretId: string) {
    setSelected((current) =>
      current.includes(secretId)
        ? current.filter((id) => id !== secretId)
        : [...current, secretId],
    );
  }

  return (
    <div className="space-y-2">
      <SelectionBar
        selectedCount={live.length}
        totalCount={document.entries.length}
        isAllSelected={isAllSelected}
        canCopy={canReveal}
        isBusy={controller.isCopyingMany}
        onSelectAll={() => setSelected(document.entries.map((entry) => entry.id))}
        onClear={() => setSelected([])}
        onCopySelected={() => void controller.copyMany(live)}
        onCopyAll={() => void controller.copyMany([])}
      />

      <ul className="space-y-1.5">
        {document.entries.map((entry) => (
          <SecretRow
            key={entry.id}
            entry={entry}
            value={controller.revealed[entry.id]}
            isBusy={controller.busyId === entry.id}
            isSelected={chosen.has(entry.id)}
            canReveal={canReveal}
            onToggleSelected={() => toggle(entry.id)}
            onReveal={() => void controller.reveal(entry.id)}
            onHide={() => controller.hide(entry.id)}
            onCopy={() => void controller.copy(entry.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface SelectionBarProps {
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly isAllSelected: boolean;
  readonly canCopy: boolean;
  readonly isBusy: boolean;
  readonly onSelectAll: () => void;
  readonly onClear: () => void;
  readonly onCopySelected: () => void;
  readonly onCopyAll: () => void;
}

function SelectionBar({
  selectedCount,
  totalCount,
  isAllSelected,
  canCopy,
  isBusy,
  onSelectAll,
  onClear,
  onCopySelected,
  onCopyAll,
}: SelectionBarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-ui text-muted-foreground">
        <Checkbox
          checked={isAllSelected}
          aria-label={isAllSelected ? "Clear selection" : "Select every secret"}
          onChange={() => (isAllSelected ? onClear() : onSelectAll())}
        />
        {hasSelection ? `${selectedCount} selected` : `${totalCount} secrets`}
      </label>

      {hasSelection && (
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear selection
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!canCopy || !hasSelection || isBusy}
          title={
            canCopy
              ? "Copy the ticked secrets as KEY=value lines"
              : "Copying values needs the Admin role"
          }
          onClick={onCopySelected}
        >
          <Copy />
          Copy selected
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!canCopy || totalCount === 0 || isBusy}
          title={
            canCopy
              ? "Copy every secret in this document as KEY=value lines"
              : "Copying values needs the Admin role"
          }
          onClick={onCopyAll}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <Copy />}
          Copy all
        </Button>
      </div>
    </div>
  );
}

interface SecretRowProps {
  readonly entry: SecretEntry;
  readonly value: string | undefined;
  readonly isBusy: boolean;
  readonly isSelected: boolean;
  readonly canReveal: boolean;
  readonly onToggleSelected: () => void;
  readonly onReveal: () => void;
  readonly onHide: () => void;
  readonly onCopy: () => void;
}

function SecretRow({
  entry,
  value,
  isBusy,
  isSelected,
  canReveal,
  onToggleSelected,
  onReveal,
  onHide,
  onCopy,
}: SecretRowProps) {
  const isRevealed = value !== undefined;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2.5",
        isSelected ? "border-accent/50 bg-accent-soft" : "border-border",
      )}
    >
      <Checkbox
        checked={isSelected}
        aria-label={`Select ${entry.key}`}
        onChange={onToggleSelected}
      />

      <span className="metric shrink-0 text-ui font-medium text-foreground">{entry.key}</span>
      <span className="metric shrink-0 text-ui text-faint-foreground">=</span>

      <span
        className={cn(
          "metric min-w-0 flex-1 truncate text-ui",
          isRevealed ? "text-foreground" : "tracking-widest text-faint-foreground",
        )}
      >
        {isRevealed ? value : entry.maskedValue}
      </span>

      <Chip color={environmentOption(entry.environmentOptionId).color}>
        {environmentOption(entry.environmentOptionId).label}
      </Chip>

      <span className="metric hidden shrink-0 items-center gap-1.5 text-micro text-faint-foreground sm:flex">
        <UserAvatar user={entry.rotatedBy} className="size-4" />
        {formatRelativeTime(entry.updatedAt)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={!canReveal || isBusy}
          aria-label={isRevealed ? `Hide ${entry.key}` : `Reveal ${entry.key}`}
          onClick={isRevealed ? onHide : onReveal}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : isRevealed ? <EyeOff /> : <Eye />}
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          disabled={!canReveal || isBusy}
          aria-label={`Copy ${entry.key}`}
          onClick={onCopy}
        >
          <Copy />
        </Button>
      </div>

      {entry.note && <p className="w-full text-body text-faint-foreground">{entry.note}</p>}
    </li>
  );
}
