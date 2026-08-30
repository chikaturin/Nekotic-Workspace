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
