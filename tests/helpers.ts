import { hydrate, board, file, folder, project, type NodeSpec } from "@/mock/factory";
import type { DriveNode } from "@/types";

/** Small, predictable forest used across the unit tests. */
export function buildTestTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Development",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        folder({
          name: "Backend",
          updatedHoursAgo: 2,
          children: [
            folder({
              name: "Payment",
              updatedHoursAgo: 3,
              favorite: true,
              children: [
                file({ name: "spec.pdf", sizeBytes: 2_000, updatedHoursAgo: 3 }),
                file({ name: "flow.png", sizeBytes: 1_000, updatedHoursAgo: 4 }),
              ],
            }),
            board({ name: "Roadmap", boardKind: "timeline", itemCount: 4, openCount: 1 }),
          ],
        }),
        folder({ name: "Frontend", updatedHoursAgo: 6, children: [] }),
      ],
    }),
    file({ name: "notes.md", sizeBytes: 500, updatedHoursAgo: 10, trashed: true }),
  ];

  return hydrate(specs, { workspaceId: "ws_test", parentId: null, idPrefix: "t" });
}

export const ID = {
  development: "t_development",
  backend: "t_development_backend",
  payment: "t_development_backend_payment",
  frontend: "t_development_frontend",
  spec: "t_development_backend_payment_spec_pdf",
  roadmap: "t_development_backend_roadmap",
} as const;
