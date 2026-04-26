/**
 * index.ts
 * ========
 * Aegis CCIP-Read gateway — serves full ML-DSA public keys for *.0xaegis.eth agents.
 *
 * When an ENS client resolves a name like alice.0xaegis.eth and requests
 * the full public key, the AegisENSResolver contract reverts with
 * OffchainLookup (EIP-3668), pointing to this server. The client then
 * fetches the key here and passes it back on-chain for hash verification.
 *
 * Start: npm run dev  (development)
 *        npm run start  (production, after npm run build)
 *
 * Routes:
 *   GET  /health                       — liveness probe
 *   GET  /ccip/:sender/:data.json      — CCIP-Read key lookup
 *   POST /register                     — register a new agent's public key
 *   GET  /keys                         — list all registered keys
 */

import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet  from "helmet";
import morgan  from "morgan";
import { corsMiddleware } from "./middleware/cors";
import ccipRouter from "./routes/ccip";
import { KeyStore } from "./services/keyStore";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const app  = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(corsMiddleware);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/", ccipRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "internal_error", message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Aegis Gateway] Listening on :${PORT}`);
  console.log(`  CCIP-Read: GET /ccip/:sender/:data.json`);
  console.log(`  Register:  POST /register`);
  console.log(`  Keys:      GET /keys`);
  console.log(`  Health:    GET /health`);
  console.log(`  Keys registered: ${KeyStore.count()}`);
});

export default app;
