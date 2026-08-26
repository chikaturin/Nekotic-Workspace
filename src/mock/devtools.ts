import { PRODUCTION_OPTION_ID } from "@/lib/board-templates";
import type { ConfigFormat } from "@/types";

/** Seed content for config documents, keyed by node slug. */
export interface ConfigSeed {
  readonly format?: ConfigFormat;
  readonly environmentOptionId: string;
  readonly content: string;
}

const PAYMENT_CONFIG = `{
  "port": 6868,
  "apiUrl": "https://api.nexdrop.vn",
  "providers": {
    "stripe": { "timeoutMs": 8000, "retries": 3 },
    "vnpay": { "timeoutMs": 12000, "retries": 2 }
  },
  "features": {
    "refunds": true,
    "payouts": false
  },
  "reconciliation": { "cron": "0 2 * * *", "thresholdPercent": 0.05 }
}
`;

const DEFAULT_CONFIG = `PORT=6868
API_URL=https://api.nexdrop.vn
LOG_LEVEL=info
# Provider timeouts are in milliseconds
STRIPE_TIMEOUT_MS=8000
VNPAY_TIMEOUT_MS=12000
`;

export const CONFIG_SEEDS: Readonly<Record<string, ConfigSeed>> = {
  "payment-service-config": {
    format: "json",
    environmentOptionId: PRODUCTION_OPTION_ID,
    content: PAYMENT_CONFIG,
  },
  default: { format: "env", environmentOptionId: "env_0", content: DEFAULT_CONFIG },
};

/** Seed material for secret documents. Values never reach the client unasked. */
export interface SecretSeed {
  readonly key: string;
  readonly value: string;
  readonly environmentOptionId: string;
  readonly note?: string;
}

const PAYMENT_SECRETS: readonly SecretSeed[] = [
  {
    key: "DATABASE_PASSWORD",
    value: "pg-3f9c-Ab21-Qz77-payments",
    environmentOptionId: PRODUCTION_OPTION_ID,
    note: "Rotate with the quarterly credential review.",
  },
  {
    key: "JWT_SECRET",
    value: "b7d1e0c4f28a4f5f9a1c6e3d8b2f7a04",
    environmentOptionId: PRODUCTION_OPTION_ID,
  },
  {
    key: "STRIPE_SECRET_KEY",
    value: "sk_live_51NdX2mKq7RfP0aZ4tYb8Uv",
    environmentOptionId: PRODUCTION_OPTION_ID,
  },
  {
    key: "VNPAY_HASH_SECRET",
    value: "VNP-7A21-DDE9-4410-8C33",
    environmentOptionId: "env_1",
  },
  {
    key: "SANDBOX_API_KEY",
    value: "sbx_9f31c8ad4e7b",
    environmentOptionId: "env_0",
    note: "Safe to share with contractors.",
  },
];

export const SECRET_SEEDS: Readonly<Record<string, readonly SecretSeed[]>> = {
  "payment-secrets": PAYMENT_SECRETS,
  default: PAYMENT_SECRETS.slice(0, 3),
};
