"use client";

import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSimulation } from "@/hooks/use-simulation";
import type { LatencyProfile, ListFailureMode } from "@/services/simulation";

const LIST_MODES: readonly { value: ListFailureMode; label: string }[] = [
  { value: "none", label: "Normal" },
  { value: "empty", label: "Empty response" },
  { value: "network", label: "Network error" },
  { value: "permission", label: "Permission denied" },
];

const LATENCIES: readonly LatencyProfile[] = ["fast", "normal", "slow"];

/**
 * Mock-only switches that force each async state. Ships with the prototype so
 * loading, empty, error and denied screens can be reviewed without a backend.
 */
export function SimulationMenu() {
  const { config, update } = useSimulation();
  const isActive =
    config.listFailure !== "none" || config.failUploads || config.failSaves || config.latency !== "normal";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant={isActive ? "subtle" : "outline"}
              aria-label="Simulation settings"
            >
              <FlaskConical className={isActive ? "text-accent" : undefined} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Simulate loading, error and permission states</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Listing response</DropdownMenuLabel>
        {LIST_MODES.map((mode) => (
          <DropdownMenuCheckboxItem
            key={mode.value}
            checked={config.listFailure === mode.value}
            onCheckedChange={() => update({ listFailure: mode.value })}
          >
            {mode.label}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Writes</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={config.failUploads}
          onCheckedChange={(checked) => update({ failUploads: checked === true })}
        >
          Fail every upload
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={config.failSaves}
          onCheckedChange={(checked) => update({ failSaves: checked === true })}
        >
          Fail every page save
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Latency</DropdownMenuLabel>
        {LATENCIES.map((latency) => (
          <DropdownMenuCheckboxItem
            key={latency}
            checked={config.latency === latency}
            onCheckedChange={() => update({ latency })}
          >
            {latency}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            update({ listFailure: "none", failUploads: false, failSaves: false, latency: "normal" })
          }
        >
          Reset simulation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
