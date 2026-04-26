import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

import { AegisWallet } from "../sdk/src/wallet";
import { AegisENS } from "../sdk/src/ens";
import { ENS_CONFIG } from "../config/ens.config";

const RPC_URL        = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY!;

// The agent label to register — becomes alice.0xaegis.eth
const AGENT_LABEL    = "alice";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Registering agent: ${AGENT_LABEL}.${ENS_CONFIG.PARENT_DOMAIN}`);
  console.log(`Signer: ${signer.address}`);

  // Generate a fresh PQ wallet for this agent
  const agentWallet = new AegisWallet(AGENT_LABEL);
  console.log(`\nAgent PQ key generated.`);
  console.log(`pubKeyHash: ${agentWallet.publicKeyHash()}`);

  // Initialise AegisENS with the signer
  const ens = new AegisENS(provider, signer);
  await ens.init();

  // Predict the account address before deploying
  const predicted = await ens.predictAgentAddress(
    signer.address,
    signer.address, // oracle = same wallet for testing
    agentWallet.publicKeyHash()
  );
  console.log(`\nPredicted account address: ${predicted}`);

  // Deploy via factory + register on ENS in one call
  console.log(`\nDeploying account and registering ENS...`);
  const result = await ens.deployAgent(
    AGENT_LABEL,
    signer.address,
    signer.address,
    agentWallet.publicKeyHash(),
    {
      capabilities: "trade,escrow,price-feed",
      endpoint:     `https://${AGENT_LABEL}.0xaegis.eth/rpc`,
      price:        "0.001",
      model:        "demo",
      uptime:       "100",
    }
  );

  console.log(`\n✓ Agent deployed.`);
  console.log(`  Account address: ${result.accountAddress}`);
  console.log(`  ENS name:        ${result.ensName}`);
  console.log(`  Tx hash:         ${result.txHash}`);

  // Verify the full resolution chain
  console.log(`\nVerifying resolution chain...`);

  // 1. Direct resolver lookup
  const resolverContract = new ethers.Contract(
    ENS_CONFIG.AEGIS_RESOLVER_ADDRESS,
    ["function addr(bytes32 node) view returns (address)",
     "function text(bytes32 node, string key) view returns (string)"],
    provider
  );

  const node = ethers.namehash(`${AGENT_LABEL}.${ENS_CONFIG.PARENT_DOMAIN}`);
  const addrFromResolver = await resolverContract.addr(node);
  console.log(`  resolver.addr(node):  ${addrFromResolver}`);

  // 2. ethers provider resolution (full ENS stack)
  try {
    const resolved = await provider.resolveName(`${AGENT_LABEL}.${ENS_CONFIG.PARENT_DOMAIN}`);
    console.log(`  provider.resolveName: ${resolved}`);
    if (resolved?.toLowerCase() === result.accountAddress.toLowerCase()) {
      console.log(`  ✓ Full resolution confirmed.`);
    }
  } catch (e: any) {
    console.log(`  provider.resolveName failed: ${e.message}`);
    console.log(`  This is OK if the parent resolver is not yet wired. Check ens-setup.ts step 6.`);
  }

  // 3. Text record check
  const capabilities = await resolverContract.text(node, "capabilities");
  console.log(`  capabilities: ${capabilities}`);

  console.log(`\n✓ Done. Save this pubKeyHash — you will need it to verify signatures:`);
  console.log(`  ${agentWallet.publicKeyHash()}`);
  console.log(`\nSave the agent secret key to a file if you want to sign with it in later tests.`);
}

main().catch(e => { console.error(e); process.exit(1); });