"use client";

import { motion } from "framer-motion";
import { ChevronRight, Layers } from "lucide-react";
import { Fragment } from "react";
import { BreadcrumbCrumb } from "@/components/layout/header/breadcrumb-crumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routableHref } from "@/lib/exported-routes";
import { BREADCRUMB_VISIBLE_LIMIT } from "@/config/app";
import Link from "next/link";
import type { BreadcrumbTrail } from "@/types";

interface BreadcrumbNavProps {
  readonly trail: BreadcrumbTrail;
}

export function BreadcrumbNav({ trail }: BreadcrumbNavProps) {
  if (trail.length === 0) return null;

  const isOverflowing = trail.length > BREADCRUMB_VISIBLE_LIMIT;
  const head = trail[0]!;
  const overflow = isOverflowing ? trail.slice(1, trail.length - (BREADCRUMB_VISIBLE_LIMIT - 2)) : [];
  const tail = isOverflowing ? trail.slice(trail.length - (BREADCRUMB_VISIBLE_LIMIT - 2)) : trail.slice(1);

  return (
    <nav aria-label="Breadcrumb" className="group/breadcrumb flex min-w-0 items-center gap-0.5">
      <Layers className="mr-1 size-3.5 shrink-0 text-faint-foreground" />

      <BreadcrumbCrumb item={head} dropTargetId={null} />

      {overflow.length > 0 && (
        <>
          <Separator />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-md px-1.5 py-1 text-lead text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              aria-label="Show hidden path segments"
            >
              …
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {overflow.map((item) => (
                <DropdownMenuItem key={item.id} asChild>
                  <Link href={routableHref(item.href)}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {tail.map((item) => (
        <Fragment key={item.id}>
          <Separator />
          <motion.span
            layout
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 items-center"
          >
            <BreadcrumbCrumb item={item} dropTargetId={item.id} />
          </motion.span>
        </Fragment>
      ))}
    </nav>
  );
}

function Separator() {
  return <ChevronRight className="size-3.5 shrink-0 text-faint-foreground" aria-hidden />;
}
