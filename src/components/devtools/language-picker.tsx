"use client";

import { Code2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { CONFIG_FORMATS, CONFIG_FORMAT_LABELS, isConfigFormat } from "@/lib/syntax";
import type { ConfigFormat } from "@/types";

interface LanguagePickerProps {
  readonly value: ConfigFormat;
  readonly canEdit: boolean;
  readonly onChange: (format: ConfigFormat) => void;
}

const OPTIONS = CONFIG_FORMATS.map((format) => ({
  value: format,
  label: CONFIG_FORMAT_LABELS[format],
}));

/**
 * Which language a config document is written in.
 *
 * One control, used by the document header. It is a `Select` rather than a
 * native one so the trigger can carry the glyph and the list stays in the
 * workspace's own type scale — and because there are fifteen entries, which is
 * exactly the length at which a native dropdown becomes a scroll.
 *
 * Changing it changes how the document is coloured and which formatter it is
 * offered. It never touches the content: a JSON file relabelled TypeScript is
 * still the same bytes, badly coloured, and that is recoverable. A picker that
 * "converted" would not be.
 */
export function LanguagePicker({ value, canEdit, onChange }: LanguagePickerProps) {
  return (
    <Select
      size="sm"
      aria-label="Language"
      options={OPTIONS}
      value={value}
      isDisabled={!canEdit}
      isSearchable
      searchPlaceholder="Find a language…"
      className="w-40"
      onValueChange={(next) => {
        if (isConfigFormat(next)) onChange(next);
      }}
      renderValue={(option) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <Code2 aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />
          <span className="truncate">{option?.label ?? CONFIG_FORMAT_LABELS[value]}</span>
        </span>
      )}
    />
  );
}
