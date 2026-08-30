import type { Block } from "@/types";

export const DOCUMENT_CONTENT: Readonly<Record<string, readonly Block[]>> = {
  "payment-integration-notes": [
    { id: "pin_1", type: "heading1", text: "Payment integration notes" },
    {
      id: "pin_2",
      type: "paragraph",
      text: "Working notes for the multi-provider rollout. Stripe is live, VNPay is in staging, Momo is behind a feature flag.",
    },
    { id: "pin_3", type: "heading2", text: "Open decisions" },
    { id: "pin_4", type: "checklist", text: "Confirm idempotency key TTL with the ledger team", isChecked: true },
    { id: "pin_5", type: "checklist", text: "Decide retry budget for webhook replays", isChecked: false },
    { id: "pin_6", type: "checklist", text: "Sign off PCI boundary with Legal", isChecked: false },
    { id: "pin_7", type: "heading3", text: "Provider rollout order" },
    { id: "pin_8", type: "numberedList", text: "Stripe — production, 100% traffic" },
    { id: "pin_9", type: "numberedList", text: "VNPay — staging, internal cards only" },
    { id: "pin_10", type: "numberedList", text: "Momo — flagged off until reconciliation lands" },
    {
      id: "pin_11",
      type: "quote",
      text: "Never trust a webhook you have not verified. Every payload is replayable.",
    },
    {
      id: "pin_12",
      type: "code",
      language: "typescript",
      code: "export async function refund(input: RefundInput): Promise<RefundResult> {\n  const charge = await ledger.findCharge(input.chargeId);\n  if (!charge) throw new NotFoundError('charge');\n  return provider(charge.provider).refund(charge, input.amount);\n}",
    },
    { id: "pin_13", type: "heading2", text: "Provider limits" },
    {
      id: "pin_14",
      type: "table",
      hasHeaderRow: true,
      rows: [
        ["Provider", "Max amount", "Settlement"],
        ["Stripe", "50,000 USD", "T+2"],
        ["VNPay", "200,000,000 VND", "T+1"],
        ["Momo", "20,000,000 VND", "T+1"],
      ],
    },
    { id: "pin_15", type: "bulletList", text: "Reconciliation runs at 02:00 UTC" },
    { id: "pin_16", type: "bulletList", text: "Mismatch threshold is 0.05% per provider" },
    {
      id: "pin_17",
      type: "link",
      url: "https://stripe.com/docs/webhooks",
      title: "Stripe webhook signatures",
      description: "How to verify that an event really came from Stripe.",
      siteName: "stripe.com",
    },
    {
      id: "pin_18",
      type: "image",
      images: [],
      caption: "Webhook retry flow — add images to illustrate the sequence",
    },
    {
      id: "pin_18b",
      type: "embed",
      boardNodeId: "nd_development_api_catalogue",
      viewId: null,
    },
    {
      id: "pin_19",
      type: "attachment",
      assetId: null,
      name: "payment-gateway-spec.pdf",
      sizeBytes: 2_418_004,
      mimeType: "application/pdf",
    },
  ],

  "engineering-handbook": [
    { id: "eh_1", type: "heading1", text: "Engineering handbook" },
    {
      id: "eh_2",
      type: "paragraph",
      text: "How this team ships. Read it on your first day, argue with it in your first month.",
    },
    { id: "eh_3", type: "heading2", text: "Principles" },
    { id: "eh_4", type: "bulletList", text: "Small reversible changes over big irreversible ones" },
    { id: "eh_5", type: "bulletList", text: "The person who writes the code owns the pager" },
    { id: "eh_6", type: "bulletList", text: "If it is not in the tree, it does not exist" },
    { id: "eh_7", type: "heading2", text: "Review checklist" },
    { id: "eh_8", type: "checklist", text: "Tests cover the failure path, not only the happy one", isChecked: true },
    { id: "eh_9", type: "checklist", text: "Errors are surfaced to the user, never swallowed", isChecked: true },
    { id: "eh_10", type: "checklist", text: "No business rules hard-coded in components", isChecked: false },
    {
      id: "eh_11",
      type: "quote",
      text: "A pull request is a proposal, not a delivery. Expect it to change.",
    },
  ],

  "component-review": [
    { id: "cr_1", type: "heading1", text: "Component review — Aurora UI" },
    {
      id: "cr_2",
      type: "paragraph",
      text: "This page is locked while the design council signs off. Unlock it to continue editing.",
    },
    { id: "cr_3", type: "heading2", text: "Sign-off" },
    { id: "cr_4", type: "checklist", text: "Tokens frozen for v2", isChecked: true },
    { id: "cr_5", type: "checklist", text: "Dark theme contrast verified", isChecked: true },
    {
      id: "cr_6",
      type: "table",
      hasHeaderRow: true,
      rows: [
        ["Component", "Status", "Owner"],
        ["Button", "Approved", "Mai Tran"],
        ["Data table", "Changes requested", "Duc Pham"],
      ],
    },
  ],

  "q3-launch-brief": [
    { id: "ql_1", type: "heading1", text: "Q3 launch brief" },
    {
      id: "ql_2",
      type: "paragraph",
      text: "Archived after the launch shipped. Kept for the retro and the numbers.",
    },
    { id: "ql_3", type: "bulletList", text: "Teaser video reached 41k views in week one" },
    { id: "ql_4", type: "bulletList", text: "Press kit downloaded 318 times" },
  ],

  "untitled-page": [{ id: "up_1", type: "paragraph", text: "" }],
} as const;

export function contentForSlug(slug: string): readonly Block[] {
  return DOCUMENT_CONTENT[slug] ?? [];
}
