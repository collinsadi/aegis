/**
 * publish-threat-feed.ts
 * ======================
 * Registers threat.0xaegis.eth as a known node on the AegisENSResolver
 * and writes the initial quantum threat status text records.
 *
 * Run once after ens-setup.ts completes:
 *   npm run publish:threat-feed
 *
 * After running, anyone can read live threat status from threat.0xaegis.eth.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { ENS_CONFIG } from "../config/ens.config";
import AegisENSResolverAbi from "../sdk/abis/AegisENSResolver.json";

const RPC_URL        = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY!;

// Initial threat state — score 0, ECDSA safe, no factors active
const INITIAL_THREAT = {
  score:             "0",
  ecdsaSafe:         "true",
  lastUpdated:       Math.floor(Date.now() / 1000).toString(),
  triggeredBy:       "",
  recommendedAction: "monitor",
};

async function main() {
  if (!RPC_URL || !PRIVATE_KEY) {
    console.error("Missing SEPOLIA_RPC_URL or DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  if (!ENS_CONFIG.AEGIS_RESOLVER_ADDRESS) {
    console.error("AEGIS_RESOLVER_ADDRESS not set in config/ens.config.ts");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const resolver = new ethers.Contract(
    ENS_CONFIG.AEGIS_RESOLVER_ADDRESS,
    (AegisENSResolverAbi as any).abi,
    signer
  );

  const threatNode            = ethers.namehash(ENS_CONFIG.THREAT_FEED_DOMAIN);
  // pubKeyHash is the keccak256 of the literal string "threat-feed" — just a marker
  const placeholderPubKeyHash = ethers.keccak256(ethers.toUtf8Bytes("aegis-threat-feed-v1"));

  console.log("=== Publishing threat.0xaegis.eth ===\n");
  console.log(`Threat feed domain : ${ENS_CONFIG.THREAT_FEED_DOMAIN}`);
  console.log(`Threat node hash   : ${threatNode}`);
  console.log(`Resolver address   : ${ENS_CONFIG.AEGIS_RESOLVER_ADDRESS}`);
  console.log(`Signer             : ${signer.address}`);

  // Step 1: Register the threat feed node as an agent record so setText works.
  // We use the deployer address as a placeholder accountAddress.
  console.log("\n[1] Checking if threat node is already registered...");
  let record: any;
  try {
    record = await resolver.getAgentRecord(threatNode);
  } catch {
    record = { exists: false };
  }

  if (!record.exists) {
    console.log("[1] Registering threat.0xaegis.eth node on resolver...");
    console.log(`    node          : ${threatNode}`);
    console.log(`    accountAddress: ${signer.address}  (placeholder)`);
    console.log(`    pubKeyHash    : ${placeholderPubKeyHash}`);
    const regTx = await resolver.registerAgent(
      threatNode,
      signer.address,
      placeholderPubKeyHash
    );
    await regTx.wait();
    console.log(`    ✓ Registered. Tx: ${regTx.hash}`);
  } else {
    console.log("[1] Already registered. Skipping.");
  }

  // Step 2: Write initial threat text records
  const threatKeys = ENS_CONFIG.THREAT_RECORD_KEYS;
  const keys = [
    threatKeys.SCORE,
    threatKeys.ECDSA_SAFE,
    threatKeys.LAST_UPDATED,
    threatKeys.TRIGGERED_BY,
    threatKeys.RECOMMENDED_ACTION,
  ];
  const values = [
    INITIAL_THREAT.score,
    INITIAL_THREAT.ecdsaSafe,
    INITIAL_THREAT.lastUpdated,
    INITIAL_THREAT.triggeredBy,
    INITIAL_THREAT.recommendedAction,
  ];

  console.log("\n[2] Writing threat status text records...");
  keys.forEach((k, i) => console.log(`    ${k.padEnd(20)}: ${values[i]}`));

  const tx = await resolver.setTextBatch(threatNode, keys, values);
  await tx.wait();
  console.log(`    ✓ Records written. Tx: ${tx.hash}`);

  // Step 3: Verify
  console.log("\n[3] Verifying text records...");
  for (let i = 0; i < keys.length; i++) {
    const stored = await resolver.text(threatNode, keys[i]);
    const match = stored === values[i];
    console.log(`    ${match ? "✓" : "✗"} ${keys[i].padEnd(20)}: "${stored}"`);
  }

  console.log("\n=== Done ===");
  console.log(`\nAnyone can now read threat status:`);
  console.log(`  resolver.text(namehash("threat.0xaegis.eth"), "score")`);
  console.log(`  resolver.text(namehash("threat.0xaegis.eth"), "ecdsaSafe")`);
  console.log(`\nTo update threat status from the oracle, call:`);
  console.log(`  npm run demo  →  Step 5 triggers oracle and writes updated records\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
