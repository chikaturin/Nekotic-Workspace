import { board, doc, file, folder, hydrate, project, type NodeSpec } from "@/mock/factory";
import { documentExcerpt } from "@/lib/blocks";
import { contentForSlug } from "@/mock/document-content";
import type { DriveNode } from "@/types";

/** Documents declare their summary from the seeded blocks — never by hand. */
function docSpecFrom(
  name: string,
  slug: string,
  options: {
    icon: string;
    updatedHoursAgo: number;
    pinned?: boolean;
    locked?: boolean;
    archived?: boolean;
    favorite?: boolean;
    shared?: boolean;
    ownerIndex?: number;
  },
) {
  const blocks = contentForSlug(slug);
  return doc({
    name,
    icon: options.icon,
    blockCount: blocks.length,
    excerpt: documentExcerpt(blocks, 120),
    updatedHoursAgo: options.updatedHoursAgo,
    pinned: options.pinned,
    locked: options.locked,
    archived: options.archived,
    favorite: options.favorite,
    shared: options.shared,
    ownerIndex: options.ownerIndex,
  });
}

/* ------------------------------------------------------------------ NexDrop */

const paymentFolder = folder({
  name: "Payment",
  updatedHoursAgo: 2,
  favorite: true,
  shared: true,
  children: [
    docSpecFrom("Payment Integration Notes", "payment-integration-notes", {
      icon: "💳",
      updatedHoursAgo: 1,
      favorite: true,
      shared: true,
    }),
    board({
      name: "Payment Sprint",
      boardKind: "kanban",
      itemCount: 48,
      openCount: 12,
      updatedHoursAgo: 1,
      favorite: true,
    }),
    folder({
      name: "Reconciliation",
      updatedHoursAgo: 26,
      children: [
        file({ name: "daily-settlement.csv", sizeBytes: 284_912, updatedHoursAgo: 26 }),
        file({
          name: "mismatch-report.md",
          sizeBytes: 12_480,
          updatedHoursAgo: 30,
          excerpt:
            "# Mismatch report — week 34\n\n| Provider | Volume | Delta |\n| --- | --- | --- |\n| Stripe | 18,402 | 0.02% |\n| VNPay | 9,145 | 0.11% |\n| Momo | 4,880 | 0.04% |\n\nRoot cause: webhook retries double-counted between 02:00 and 02:40 UTC.",
        }),
      ],
    }),
    file({
      name: "payment-gateway-spec.pdf",
      sizeBytes: 2_418_004,
      updatedHoursAgo: 3,
      shared: true,
      excerpt:
        "Payment Gateway Specification v4.2\n\n1. Scope\n2. Provider matrix (Stripe, VNPay, Momo)\n3. Idempotency contract\n4. Webhook signature verification\n5. Refund + chargeback flows\n6. PCI-DSS boundary and tokenisation",
    }),
    file({ name: "webhook-flow.png", sizeBytes: 862_133, updatedHoursAgo: 5, favorite: true }),
    file({ name: "checkout-mock.png", sizeBytes: 1_204_770, updatedHoursAgo: 9 }),
    file({
      name: "refund-service.ts",
      sizeBytes: 18_944,
      updatedHoursAgo: 4,
      version: 7,
      excerpt:
        "export async function refund(input: RefundInput): Promise<RefundResult> {\n  const charge = await ledger.findCharge(input.chargeId);\n  if (!charge) throw new NotFoundError('charge');\n  if (charge.refundedAmount + input.amount > charge.amount) {\n    throw new DomainError('refund exceeds captured amount');\n  }\n  return provider(charge.provider).refund(charge, input.amount);\n}",
    }),
    file({
      name: "ledger-schema.sql",
      sizeBytes: 7_211,
      updatedHoursAgo: 40,
      excerpt:
        "create table ledger_entry (\n  id           uuid primary key,\n  account_id   uuid not null references account(id),\n  direction    entry_direction not null,\n  amount_minor bigint not null check (amount_minor > 0),\n  currency     char(3) not null,\n  posted_at    timestamptz not null default now()\n);",
    }),
  ],
});

const backendFolder = folder({
  name: "Backend",
  updatedHoursAgo: 2,
  children: [
    paymentFolder,
    folder({
      name: "Auth Service",
      updatedHoursAgo: 12,
      children: [
        file({ name: "session-strategy.md", sizeBytes: 9_820, updatedHoursAgo: 12 }),
        file({ name: "token-rotation.ts", sizeBytes: 14_106, updatedHoursAgo: 15 }),
        file({ name: "threat-model.pdf", sizeBytes: 1_802_441, updatedHoursAgo: 60 }),
      ],
    }),
    folder({
      name: "Notifications",
      updatedHoursAgo: 55,
      children: [
        file({ name: "fanout-benchmark.xlsx", sizeBytes: 402_118, updatedHoursAgo: 55 }),
        file({ name: "template-registry.json", sizeBytes: 24_690, updatedHoursAgo: 70 }),
      ],
    }),
    board({
      name: "Backend Roadmap",
      boardKind: "timeline",
      itemCount: 31,
      openCount: 9,
      updatedHoursAgo: 8,
    }),
    file({
      name: "api-contract.md",
      sizeBytes: 41_002,
      updatedHoursAgo: 6,
      shared: true,
      excerpt:
        "# Public API contract\n\nAll endpoints are versioned under /v1 and return the envelope:\n\n{ \"success\": true, \"data\": T | null, \"error\": string | null, \"meta\": Meta | null }\n\nRate limit: 600 req/min per workspace token.",
    }),
    file({ name: "service-topology.png", sizeBytes: 733_190, updatedHoursAgo: 21 }),
  ],
});

const developmentProject = project({
  name: "Development",
  color: "var(--kind-code)",
  description: "Platform engineering — services, infrastructure and release trains.",
  updatedHoursAgo: 1,
  favorite: true,
  shared: true,
  children: [
    backendFolder,
    folder({
      name: "Frontend",
      updatedHoursAgo: 7,
      children: [
        folder({
          name: "Design Tokens",
          updatedHoursAgo: 33,
          children: [
            file({ name: "tokens.json", sizeBytes: 31_442, updatedHoursAgo: 33 }),
            file({ name: "theme-preview.png", sizeBytes: 944_820, updatedHoursAgo: 34 }),
          ],
        }),
        docSpecFrom("Untitled Page", "untitled-page", { icon: "📄", updatedHoursAgo: 2 }),
        board({ name: "Frontend Sprint", boardKind: "kanban", itemCount: 64, openCount: 18, updatedHoursAgo: 7 }),
        file({ name: "component-inventory.xlsx", sizeBytes: 512_004, updatedHoursAgo: 19 }),
        file({ name: "drive-view.tsx", sizeBytes: 22_310, updatedHoursAgo: 5 }),
      ],
    }),
    folder({
      name: "Infrastructure",
      updatedHoursAgo: 29,
      children: [
        file({ name: "cluster.tf", sizeBytes: 16_002, updatedHoursAgo: 29 }),
        file({ name: "cost-report-q3.xlsx", sizeBytes: 288_411, updatedHoursAgo: 48 }),
        file({ name: "runbook.md", sizeBytes: 22_004, updatedHoursAgo: 52 }),
        file({ name: "incident-2026-07.zip", sizeBytes: 18_442_990, updatedHoursAgo: 300 }),
      ],
    }),
    docSpecFrom("Engineering Handbook", "engineering-handbook", {
      icon: "📘",
      updatedHoursAgo: 3,
      pinned: true,
      shared: true,
      ownerIndex: 1,
    }),
    board({ name: "Release Checklist", boardKind: "table", itemCount: 22, openCount: 4, updatedHoursAgo: 10 }),
    // The virtualisation target from the PRD: 5.000 records in one table view.
    board({
      name: "QA Regression Log",
      boardKind: "table",
      templateId: "qa",
      itemCount: 5000,
      openCount: 812,
      updatedHoursAgo: 2,
    }),
    board({
      name: "API Catalogue",
      boardKind: "table",
      templateId: "apiDocs",
      itemCount: 18,
      openCount: 3,
      updatedHoursAgo: 4,
    }),
    board({
      name: "Bug Tracker",
      boardKind: "kanban",
      templateId: "bug",
      itemCount: 34,
      openCount: 11,
      updatedHoursAgo: 6,
    }),
    doc({
      name: "Payment service config",
      documentKind: "config",
      icon: "⚙️",
      blockCount: 0,
      excerpt: "PORT, API_URL and the provider timeouts for each environment.",
      updatedHoursAgo: 5,
    }),
    doc({
      name: "Payment secrets",
      documentKind: "secret",
      icon: "🔐",
      blockCount: 0,
      excerpt: "Database password, JWT secret and the provider keys.",
      updatedHoursAgo: 9,
      shared: true,
    }),
    file({ name: "architecture-overview.pdf", sizeBytes: 3_918_220, updatedHoursAgo: 14, favorite: true }),
  ],
});

const designProject = project({
  name: "Design System",
  color: "var(--kind-board)",
  description: "Foundations, components and the review pipeline for Aurora UI.",
  updatedHoursAgo: 4,
  children: [
    folder({
      name: "Foundations",
      updatedHoursAgo: 4,
      children: [
        file({ name: "color-ramp.png", sizeBytes: 618_220, updatedHoursAgo: 4, favorite: true }),
        file({ name: "type-scale.png", sizeBytes: 402_889, updatedHoursAgo: 18 }),
        file({ name: "spacing-rhythm.md", sizeBytes: 8_190, updatedHoursAgo: 22 }),
      ],
    }),
    folder({
      name: "Components",
      updatedHoursAgo: 16,
      children: [
        file({ name: "button-anatomy.png", sizeBytes: 512_770, updatedHoursAgo: 16 }),
        file({ name: "data-table-spec.docx", sizeBytes: 190_442, updatedHoursAgo: 44 }),
      ],
    }),
    docSpecFrom("Component Review", "component-review", {
      icon: "🧩",
      updatedHoursAgo: 5,
      locked: true,
      ownerIndex: 2,
    }),
    board({ name: "Design QA", boardKind: "kanban", itemCount: 27, openCount: 6, updatedHoursAgo: 11 }),
  ],
});

const marketingProject = project({
  name: "Marketing",
  color: "var(--kind-video)",
  description: "Launch campaigns, brand assets and the editorial calendar.",
  updatedHoursAgo: 20,
  status: "active",
  children: [
    folder({
      name: "Campaigns 2026",
      updatedHoursAgo: 20,
      children: [
        folder({
          name: "Q3 Launch",
          updatedHoursAgo: 20,
          shared: true,
          children: [
            file({ name: "hero-banner.png", sizeBytes: 2_204_118, updatedHoursAgo: 20 }),
            file({ name: "launch-teaser.mp4", sizeBytes: 48_119_004, updatedHoursAgo: 24 }),
            file({ name: "press-release.docx", sizeBytes: 88_204, updatedHoursAgo: 27 }),
          ],
        }),
        file({ name: "channel-budget.xlsx", sizeBytes: 344_009, updatedHoursAgo: 38 }),
      ],
    }),
    docSpecFrom("Q3 Launch Brief", "q3-launch-brief", {
      icon: "🚀",
      updatedHoursAgo: 190,
      archived: true,
      ownerIndex: 3,
    }),
    board({ name: "Content Calendar", boardKind: "table", itemCount: 58, openCount: 21, updatedHoursAgo: 23 }),
    file({ name: "brand-guidelines.pdf", sizeBytes: 6_204_881, updatedHoursAgo: 96, shared: true }),
  ],
});

const companyFolder = folder({
  name: "Company",
  updatedHoursAgo: 72,
  children: [
    folder({
      name: "Handbook",
      updatedHoursAgo: 72,
      children: [
        file({ name: "onboarding.md", sizeBytes: 18_442, updatedHoursAgo: 72 }),
        file({ name: "security-policy.pdf", sizeBytes: 1_118_220, updatedHoursAgo: 140 }),
      ],
    }),
    file({ name: "all-hands-2026-08.mp4", sizeBytes: 184_220_118, updatedHoursAgo: 80 }),
    file({ name: "org-chart.png", sizeBytes: 402_118, updatedHoursAgo: 210, trashed: true }),
  ],
});

const legalVaultFolder = folder({
  name: "Legal Vault",
  updatedHoursAgo: 120,
  restricted: true,
  ownerIndex: 3,
  children: [
    file({ name: "master-service-agreement.pdf", sizeBytes: 1_804_220, updatedHoursAgo: 120 }),
    file({ name: "cap-table.xlsx", sizeBytes: 244_118, updatedHoursAgo: 130 }),
  ],
});

const NEXDROP_SPEC: readonly NodeSpec[] = [
  developmentProject,
  designProject,
  marketingProject,
  companyFolder,
  legalVaultFolder,
  file({ name: "quarterly-okrs.xlsx", sizeBytes: 233_118, updatedHoursAgo: 46 }),
  file({ name: "deprecated-pitch.pdf", sizeBytes: 900_118, updatedHoursAgo: 400, trashed: true }),
];

/* -------------------------------------------------------------- Aurora Labs */

const AURORA_SPEC: readonly NodeSpec[] = [
  project({
    name: "Research",
    color: "var(--kind-image)",
    description: "Applied ML experiments and evaluation harnesses.",
    updatedHoursAgo: 5,
    children: [
      folder({
        name: "Experiments",
        updatedHoursAgo: 5,
        children: [
          file({ name: "eval-matrix.csv", sizeBytes: 118_442, updatedHoursAgo: 5 }),
          file({ name: "training-loss.png", sizeBytes: 288_119, updatedHoursAgo: 9 }),
        ],
      }),
      board({ name: "Experiment Log", boardKind: "table", itemCount: 41, openCount: 13, updatedHoursAgo: 6 }),
    ],
  }),
  folder({
    name: "Partners",
    updatedHoursAgo: 60,
    children: [file({ name: "mou-draft.pdf", sizeBytes: 802_119, updatedHoursAgo: 60 })],
  }),
];

/* ----------------------------------------------------------------- exports */

export const NEXDROP_TREE: readonly DriveNode[] = hydrate(NEXDROP_SPEC, {
  workspaceId: "ws_nexdrop",
  parentId: null,
  idPrefix: "nd",
});

export const AURORA_TREE: readonly DriveNode[] = hydrate(AURORA_SPEC, {
  workspaceId: "ws_aurora",
  parentId: null,
  idPrefix: "al",
});

export const TREES_BY_WORKSPACE: Readonly<Record<string, readonly DriveNode[]>> = {
  ws_nexdrop: NEXDROP_TREE,
  ws_aurora: AURORA_TREE,
};
