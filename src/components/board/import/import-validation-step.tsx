"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { IMPORT_ISSUE_LIMIT } from "@/config/app";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ImportInvalidPolicy, ImportPlan } from "@/types";

interface ImportValidationStepProps {
  readonly plan: ImportPlan;
  readonly policy: ImportInvalidPolicy;
  readonly onSetPolicy: (policy: ImportInvalidPolicy) => void;
}

const POLICY_LABELS: Readonly<Record<ImportInvalidPolicy, string>> = {
  skip: "Leave those rows out",
  blank: "Import them with the flagged cells empty",
};

export function ImportValidationStep({ plan, policy, onSetPolicy }: ImportValidationStepProps) {
  const shown = plan.issues.slice(0, IMPORT_ISSUE_LIMIT);
  const isClean = plan.invalidCount === 0;

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            isClean ? "bg-success/10" : "bg-warning/10",
          )}
        >
          {isClean ? (
            <CircleCheck className="size-4 text-success" />
          ) : (
            <TriangleAlert className="size-4 text-warning" />
          )}
        </span>

        <div className="min-w-0">
          <p className="text-lead font-medium text-foreground">
            {isClean
              ? `${formatCount(plan.validCount, "row")} ready to import`
              : `${formatCount(plan.invalidCount, "row")} ${plan.invalidCount === 1 ? "needs" : "need"} a decision`}
          </p>
          <p className="metric text-body text-faint-foreground">
            {plan.validCount} clean · {plan.invalidCount} flagged
            {plan.blankCount > 0 && ` · ${formatCount(plan.blankCount, "empty row")} ignored`}
          </p>
        </div>
      </div>

      {!isClean && (
        <>
          <RadioGroup
            label="Rows with a value the column cannot read"
            value={policy}
            onValueChange={(value) => onSetPolicy(value as ImportInvalidPolicy)}
          >
            {(Object.keys(POLICY_LABELS) as ImportInvalidPolicy[]).map((candidate) => (
              <RadioCard
                key={candidate}
                value={candidate}
                label={POLICY_LABELS[candidate]}
              />
            ))}
          </RadioGroup>

          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-body">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border">
                  <th className="w-14 p-2 font-medium text-faint-foreground">Row</th>
                  <th className="w-40 p-2 font-medium text-faint-foreground">Column</th>
                  <th className="w-40 p-2 font-medium text-faint-foreground">Value</th>
                  <th className="p-2 font-medium text-faint-foreground">Why</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((issue, index) => (
                  <tr key={`${issue.rowNumber}_${index}`} className="border-b border-hairline last:border-0">
                    <td className="metric p-2 text-foreground">{issue.rowNumber}</td>
                    <td className="p-2 text-foreground">
                      <span className="block truncate">{issue.columnName}</span>
                      <span className="block truncate text-faint-foreground">
                        from “{issue.sourceHeader}”
                      </span>
                    </td>
                    <td className="max-w-40 truncate p-2 text-warning" title={issue.value}>
                      {issue.value}
                    </td>
                    <td className="p-2 text-muted-foreground">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.issues.length > shown.length && (
            <p className="metric text-body text-faint-foreground">
              …and {plan.issues.length - shown.length} more findings across the file.
            </p>
          )}
        </>
      )}
    </div>
  );
}
