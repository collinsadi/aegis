/**
 * Server-local mirror of INTEGRATIONS from config/ens.config.ts.
 * Reads the same env vars so behavior is identical — the root config
 * is the canonical definition, this file exists only because the
 * server's tsconfig rootDir is scoped to src/ and cannot import
 * from the shared config at the project root.
 */
export const INTEGRATIONS = {
  ZERO_G: {
    ENABLED: process.env.ENABLE_ZERO_G === "true",
    STORAGE_RPC:     process.env.ZERO_G_STORAGE_RPC     ?? "https://evmrpc-testnet.0g.ai",
    STORAGE_INDEXER: process.env.ZERO_G_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai",
    COMPUTE_ENDPOINT: process.env.ZERO_G_COMPUTE_ENDPOINT ?? "https://api.0g.ai/v1",
    COMPUTE_MODEL:    process.env.ZERO_G_COMPUTE_MODEL    ?? "qwen3.6-plus",
    PRIVATE_KEY: process.env.ZERO_G_PRIVATE_KEY ?? "",
  },
} as const;
