/**
 * zerog.test.ts
 * =============
 * Verifies that the /register and /ccip endpoints use 0G Storage end-to-end.
 *
 * Run from server/:
 *   npm run test:0g
 *
 * Requires ENABLE_ZERO_G=true, ZERO_G_PRIVATE_KEY, and all other 0G env vars
 * in .env (pre-loaded by -r dotenv/config in the npm script before this file runs).
 *
 * Tests:
 *   1. ZeroGKeyStore — direct upload → download round-trip through 0G Storage
 *   2. keyStoreFactory — activeKeyStore is a ZeroGKeyStore when flag is on
 *   3. POST /register — real aria-f0pi key passes on-chain verification and is stored
 *   4. GET /ccip      — encoded node hash returns the correct 1952-byte key
 *   5. GET /health    — sanity check that the server is up
 */

import assert from "assert";
import * as crypto from "crypto";
import { ethers } from "ethers";
import { ZeroGKeyStore } from "../src/services/zerogKeyStore";
import { activeKeyStore } from "../src/services/keyStoreFactory";

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVER = "http://localhost:8080";

// Deployed demo agent — registered on Sepolia via AegisENSResolver.registerAgent()
const ARIA_ENS_NAME    = "aria-f0pi.0xaegis.eth";
const ARIA_PUBLIC_KEY  = "0xe3a811787d2204852351a8ff3c06edd4d4f5442524d3ba372a265660cfd34244a42e8524c9391241fd484874c162ff1c0dec388241fff2b8837dae2f52b30eb26420645396d376840fce41aefb2a9370e90dc46ca1acaa22d4d988aac3e28caf31819ddad352c9803319df23b92ab5a4ad66b357e49e5b00fdb4e39b7e0d097acbb56fafffce5169cacc93c520a7f8613d06f4c5f108e17492033d819fa5a83f36956ce241c5bb1d310541d57ee1e0211994526da66dce3f818859bd03fe9812ae538ead5c6cb24b0832b11629504104bbd4ee11030d69ba4f3e921db33b6a84c942499e570f406d507728949208d95db8267f998a39ad1cdff5926c69a39aff60fe498dec5c033554b42088d5f0c61bc4d1c0a80b4bec25d1377a392e0b5701cb25c7a47efbd1e6e02d18c7a6c52dc05fbf4918f517a2956dc328f3e13b038eeb0f64a635c8918f0b0e58e2200a1a16e6b3d89fcb7e6ef1fed7928a179134fab1959a34862fabb0c76a2cdb58053e42d75d6b8a6cc6cba8fe51833392035c46a2c9e1bac9e8bf38c6aeafbc41414d60a875ffb82631429b47233213e8f74d7dbca706c0b184e66dfb7b29d4ac30801d93a30a481781d19814e47e10d60cbeb7603c07fb80499b2e37719fafc2bf403b87045d625fdeab5d51b2b136c076ddd3066b3bdfcbaba4157dd4c13417ef4ea9b992ef3f6ad8136ebabdb0fcc365f07c92a01fd9b29a598b851376b1251233992b850883b078ffdfd7cbb921df15221e4d0475d6aacc88c876e922e6a01b3bc6a68dabd3fc7c2038245dc149dc77d54de668251f66915ffad502dcf722dc9e60485a1c9ad37a201ec49949989cb10f32d04524e19c1560594548a575042b99fca5e6b2e7fffb3a3bf1caf3a8b62b82c4e49e36e5bdf21123af693a8af9da7dcc8c37598577c76cd7ba7e6f60d749d8e1356c27d9a81176e4bfe8c5404149e395e74e94536b34b8d9dbde02c4f8888c4d8654ad6975d7f91b92ec428bf67fb4fa3cd5a6aad0fa509e5ed18e293cdc8515c9dfba4728c7e1bbd5aeafb52ac6021dae85c7412825acc6100c764232045dd94ba72ab93b43521fcbe495fb8df1c28052565e61e252e2d8333ef8121b3b977c6d088848d09deb4c90afe0b42bd93d760d45fe07984a381b521a334e88d06954a3597e8a78abd608a9202d430225cae761f132c0b53ed6e76f336226aefcb41f2f6d976ed39c4bc3568cf54d8ea594cfd48f76f3a463077f48c1f117fb447570e88a951f4ea94e58a61f36acd59307986f73128759296a85143cc26f0b0baa3a3c09c64e7608de71490442c77bc9bec02b9cba3aabeba287209529f8b6d9ae6d6e20a961531bbc643182ce1660aabd87c3720e24805826ecffc9b0e2022c785fd4c83ead7aee9a92bfb5d158f847a5c0e087067218e7ff4ee5753a04e99bab3a5c59cb14fe9c56625bb0f15bd69f7a4b8da3d09fea226f3c9c92f733e435a1ddac4450ac000d6d07da2acaa476a7829e8b0ebf850dacf5335b3fc8dd3c45ac9bd0dd45746be89953f4fc377e11295f333f3d3a9939a580f0ecbb23ddbe11d8632899864f80588008d5b2762cace6e2cead9935d95046b764e752012a4e396ae914b96f985120d1200417bbbdeef1648bac5c70930a6f5f5afbc2d8cba1748eb015b64f0e6787b49bc760296c50d5338d1e3c66235a5ec68911b0f9400d510cd041997aee56493854fdc5046220fb24ac12d9662b1497567f94c5f943ea90c889dc328ba06ca5153a0a4466867f573465e8c6f8c4650163846318ce7de1efe232595cfab8472587aa4e38707c60e859207a3ba0de21e27f2f45966960a64ae848f2a3faf48a7e081044a4c75e2796596c767695e80d0ff98c9817a8fa76d7dd6f7f694d68033c0af6ad6e065b6a197880665a6c5ff773a7127047b977b6ee61819e304ee457545ffaff8005d788f7c06a5262517efba300bb3702429a2e39c6a3687689019bd296ae021b1a983bd7664352af0f2fd9aa2b80d824f013c54ce034f8d1f1451d85e7ab57b26076d840cb6dd5ee34506d98eab1d109e760803f5ee4de234fd0a582efef8be37b3cefdc1d998da503c4b39fa5524ca80b5db1d40c4b6177253b2ef4e99dab89e6d74beb19d62c74b277447875e0273e0569a10c381525168b73157a6f3f5ce34fcdf9f9933df1224055adf4ba9da543285ff9924e4e3e215be4ce00e3d99bf3b3a462b082268632a9fe2d9a60bc1cb18dd0d0ad21cc637829fda7ac302ef2edb93ec0012b4b297579c3fa2e2c1599b70e4f6ccd34ae0e48aef4a0d323cfaa47cf83388a70862b1a93d18bb9c40fd441ec6ac03bad208a6d47ada80f17068917e60593a6702f4b159947b8ffb0a2aec5b5783f5aabc39cc9f8456bc8da39340fd336cd1f201c30320d478a242a117eaf656b0fc180aaa0df548815ebbf7317a7782837caa8b8764d104c52ae5cf32f535b397ae8e34a8c02fd68f66589845146dde254cb753f79150be7daa24212159eb375b2afc5a11e4034f36ee2939174422c9b22ffc5da4282a96816b491402de9b05c14565c5679c9c5b47cd7088cb75c0d34a1d6192297bd49bce4de654372a58b9808089cd8293f6abbddc71e61d8432ca2c9111a46da6d643db9494859ad8a4c1d79e7c63e2668718ea61e57b21f7a0f37ed8c8c2a1342f05bc7e17ac46c3b6588572ff3cd9e544265dc60d4c0c9b4ad9da45263847120b37acca7313eb43fd5ac8d604873";
const ARIA_LABEL       = "aria-f0pi";

// AegisENSResolver contract address (same as AEGIS_RESOLVER_ADDRESS in .env)
const RESOLVER_ADDRESS = process.env.AEGIS_RESOLVER_ADDRESS
                      ?? "0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`  ✗  ${label}`);
  console.error(`     ${msg}`);
  failed++;
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ── Prerequisite check ────────────────────────────────────────────────────────

function checkPrereqs(): boolean {
  section("Prerequisites");

  const required = [
    "ENABLE_ZERO_G",
    "ZERO_G_PRIVATE_KEY",
    "ZERO_G_STORAGE_INDEXER",
    "ZERO_G_STORAGE_RPC",
  ];

  let allOk = true;
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`  ✗  ${key} is not set`);
      allOk = false;
    } else {
      const val = key.includes("KEY") ? "***" : process.env[key];
      console.log(`  ✓  ${key}=${val}`);
    }
  }

  if (process.env.ENABLE_ZERO_G !== "true") {
    console.error("  ✗  ENABLE_ZERO_G must be 'true'");
    allOk = false;
  }

  return allOk;
}

// ── Test 1: ZeroGKeyStore direct round-trip ───────────────────────────────────

async function testZeroGKeyStoreDirect() {
  section("TEST 1 — ZeroGKeyStore: direct upload → download round-trip");

  // Use a deterministic test node so re-runs hit the same slot in rootIndex
  const testNode      = ethers.keccak256(ethers.toUtf8Bytes("aegis-zerog-test-v1"));
  const testKeyBuffer = crypto.randomBytes(1952);
  const store         = new ZeroGKeyStore();

  // 1a. Upload
  try {
    console.log(`  → Uploading 1952-byte key to 0G Storage (node: ${testNode.slice(0, 14)}…)`);
    await store.set(testNode, testKeyBuffer, "test-agent");
    ok("set() completed without error");
  } catch (e) {
    fail("set() should not throw", e);
    return; // downstream tests depend on this
  }

  // 1b. has() check (in-memory index)
  try {
    assert.strictEqual(store.has(testNode), true, "has() should return true after set()");
    ok("has() returns true");
  } catch (e) {
    fail("has() check", e);
  }

  // 1c. count()
  try {
    assert.ok(store.count() >= 1, "count() should be >= 1 after set()");
    ok(`count() = ${store.count()}`);
  } catch (e) {
    fail("count() check", e);
  }

  // 1d. Download (clears cache to force real 0G fetch)
  try {
    const nodeKey = testNode.toLowerCase();
    // Access private cache via any-cast to clear it and force a real download
    (store as any).cache.delete(nodeKey);

    console.log("  → Downloading key from 0G Storage (cache cleared)…");
    const record = await store.get(testNode);

    assert.ok(record, "get() should return a record");
    assert.strictEqual(record!.publicKey.length, 1952, "Downloaded key should be 1952 bytes");
    assert.ok(
      Buffer.from(record!.publicKey).equals(testKeyBuffer),
      "Downloaded bytes must exactly match what was uploaded"
    );
    ok("get() returned correct 1952-byte key from 0G Storage");
  } catch (e) {
    fail("get() round-trip", e);
  }

  // 1e. list()
  try {
    const all = store.list();
    assert.ok(all.length >= 1, "list() should return at least one record");
    ok(`list() returns ${all.length} record(s)`);
  } catch (e) {
    fail("list() check", e);
  }
}

// ── Test 2: keyStoreFactory returns ZeroGKeyStore ─────────────────────────────

async function testKeyStoreFactory() {
  section("TEST 2 — keyStoreFactory: activeKeyStore is ZeroGKeyStore");

  try {
    assert.strictEqual(
      activeKeyStore.constructor.name,
      "ZeroGKeyStore",
      `Expected ZeroGKeyStore, got ${activeKeyStore.constructor.name}`
    );
    ok("activeKeyStore is a ZeroGKeyStore instance");
  } catch (e) {
    fail("factory type check", e);
  }
}

// ── Test 3: POST /register ────────────────────────────────────────────────────

// Returns: "ok" | "skipped:<reason>" | "failed"
async function testHTTPRegister(): Promise<"ok" | "skipped" | "failed"> {
  section("TEST 3 — POST /register: aria-f0pi → on-chain verify → 0G upload");

  const node = ethers.namehash(ARIA_ENS_NAME);
  console.log(`  → node: ${node}`);
  console.log(`  → key:  ${ARIA_PUBLIC_KEY.slice(0, 16)}… (1952 bytes)`);

  let res: Response;
  try {
    res = await fetch(`${SERVER}/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        node,
        publicKeyHex: ARIA_PUBLIC_KEY,
        agentLabel:   ARIA_LABEL,
      }),
    });
  } catch (e) {
    fail("POST /register — server not reachable", e);
    return "failed";
  }

  const body = await res.json() as any;

  // 403 with an RPC error means chain verification failed — not a 0G issue.
  // This happens when SEPOLIA_RPC_URL in the server's .env is invalid/placeholder.
  if (res.status === 403 && typeof body.message === "string") {
    if (body.message.startsWith("RPC error:")) {
      console.log(`  ⚠  SKIPPED — chain verification failed (Sepolia RPC misconfigured, not a 0G issue)`);
      console.log(`     ${body.message.slice(0, 100)}…`);
      console.log(`     Fix SEPOLIA_RPC_URL in server/.env to enable full HTTP-flow testing.`);
      return "skipped";
    }
    if (body.message.includes("not registered on-chain")) {
      console.log(`  ⚠  SKIPPED — agent not registered on-chain (run demo steps 2–3 first)`);
      return "skipped";
    }
  }

  try {
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    ok(`POST /register → 200`);
  } catch (e) {
    fail("POST /register status", e);
    return "failed";
  }

  try {
    assert.strictEqual(body.success, true, `success should be true, got: ${JSON.stringify(body)}`);
    ok("response.success === true");
  } catch (e) {
    fail("POST /register body.success", e);
    return "failed";
  }

  try {
    const expectedHash = ethers.keccak256(Buffer.from(ARIA_PUBLIC_KEY.slice(2), "hex"));
    assert.strictEqual(
      body.pubKeyHash.toLowerCase(),
      expectedHash.toLowerCase(),
      "pubKeyHash should match keccak256 of submitted key"
    );
    ok(`pubKeyHash matches: ${body.pubKeyHash.slice(0, 18)}…`);
  } catch (e) {
    fail("POST /register pubKeyHash", e);
    return "failed";
  }

  try {
    assert.strictEqual(body.keyLength, 1952, `keyLength should be 1952, got ${body.keyLength}`);
    ok("keyLength === 1952");
  } catch (e) {
    fail("POST /register keyLength", e);
  }

  return "ok";
}

// ── Test 4: GET /ccip ─────────────────────────────────────────────────────────

async function testHTTPCCIP(registerWasSkipped: boolean) {
  section("TEST 4 — GET /ccip: node lookup returns correct ML-DSA key");

  const node    = ethers.namehash(ARIA_ENS_NAME);
  // The CCIP calldata is ABI-encoded bytes32 node hash
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [node]);
  const url     = `${SERVER}/ccip/${RESOLVER_ADDRESS}/${encoded}.json`;

  console.log(`  → node:    ${node}`);
  console.log(`  → url:     /ccip/${RESOLVER_ADDRESS.slice(0, 10)}…/${encoded.slice(0, 14)}….json`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    fail("GET /ccip — server not reachable", e);
    return;
  }

  const body = await res.json() as any;

  // If /register was skipped (RPC issue), the server's store is empty — 404 is expected.
  if (res.status === 404 && registerWasSkipped) {
    console.log("  ⚠  SKIPPED — server has no key for this node (register was skipped above)");
    console.log("     Once SEPOLIA_RPC_URL is fixed, /register will seed the store and this test will pass.");
    return;
  }

  try {
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    ok("GET /ccip → 200");
  } catch (e) {
    fail("GET /ccip status", e);
    return;
  }

  try {
    assert.ok(typeof body.data === "string" && body.data.startsWith("0x"),
      "response.data should be a 0x-prefixed hex string");
    ok("response.data is 0x-prefixed hex");
  } catch (e) {
    fail("GET /ccip response.data format", e);
    return;
  }

  // Decode the ABI-encoded key bytes and verify length and content
  try {
    const [keyBytes] = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], body.data) as [string];
    const keyBuffer  = Buffer.from(keyBytes.slice(2), "hex");

    assert.strictEqual(keyBuffer.length, 1952,
      `Decoded key should be 1952 bytes, got ${keyBuffer.length}`);
    ok("decoded key length === 1952");

    const expectedBuffer = Buffer.from(ARIA_PUBLIC_KEY.slice(2), "hex");
    assert.ok(keyBuffer.equals(expectedBuffer),
      "Decoded key bytes must match the registered aria-f0pi public key");
    ok("decoded key bytes match aria-f0pi public key exactly");
  } catch (e) {
    fail("GET /ccip key decode & verify", e);
  }
}

// ── Test 5: GET /health ───────────────────────────────────────────────────────

async function testHTTPHealth() {
  section("TEST 5 — GET /health: server up and key count");

  let res: Response;
  try {
    res = await fetch(`${SERVER}/health`);
  } catch (e) {
    fail("GET /health — server not reachable", e);
    return;
  }

  const body = await res.json() as any;

  try {
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    ok("GET /health → 200");
  } catch (e) {
    fail("GET /health status", e);
    return;
  }

  try {
    assert.strictEqual(body.status, "ok", `Expected status "ok", got "${body.status}"`);
    ok(`status === "ok"`);
  } catch (e) {
    fail("GET /health body.status", e);
  }

  try {
    assert.ok(typeof body.keys === "number" && body.keys >= 0,
      `Expected numeric key count, got ${body.keys}`);
    ok(`key count in gateway = ${body.keys}`);
  } catch (e) {
    fail("GET /health key count", e);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(  "║  Aegis × 0G Integration Test                             ║");
  console.log(  "╚══════════════════════════════════════════════════════════╝");

  const prereqsOk = checkPrereqs();
  if (!prereqsOk) {
    console.error("\n  Prerequisite check failed. Set all required env vars and retry.\n");
    process.exit(1);
  }

  await testZeroGKeyStoreDirect();
  await testKeyStoreFactory();

  const registerResult = await testHTTPRegister();
  // CCIP test runs regardless — it handles the "register was skipped" case internally
  await testHTTPCCIP(registerResult === "skipped");

  await testHTTPHealth();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(60) + "\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
