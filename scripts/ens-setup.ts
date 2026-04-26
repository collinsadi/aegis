import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC_URL         = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY     = process.env.DEPLOYER_PRIVATE_KEY!;
const AEGIS_RESOLVER  = process.env.AEGIS_RESOLVER_ADDRESS!;

const ENS_REGISTRY    = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const ETH_CONTROLLER  = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const LABEL           = "0xaegis";
const FULL_NAME       = `${LABEL}.eth`;
const DURATION        = 365 * 24 * 60 * 60;

// ENS V2 Sepolia controller — uses uint8 for reverseRecord and bytes32 for fuses
const CONTROLLER_ABI = [
  "function available(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))",
  "function commit(bytes32 commitment)",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  `function makeCommitment(
    tuple(
      string name,
      address owner,
      uint256 duration,
      bytes32 secret,
      address resolver,
      bytes[] data,
      uint8 reverseRecord,
      bytes32 ownerControlledFuses
    ) request
  ) pure returns (bytes32)`,
  `function register(
    tuple(
      string name,
      address owner,
      uint256 duration,
      bytes32 secret,
      address resolver,
      bytes[] data,
      uint8 reverseRecord,
      bytes32 ownerControlledFuses
    ) request
  ) payable`,
];

const REGISTRY_ABI = [
  "function owner(bytes32 node) view returns (address)",
  "function resolver(bytes32 node) view returns (address)",
  "function setResolver(bytes32 node, address resolver)",
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!RPC_URL || !PRIVATE_KEY || !AEGIS_RESOLVER) {
    console.error("❌ Missing env vars. Need: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, AEGIS_RESOLVER_ADDRESS");
    process.exit(1);
  }

  const provider   = new ethers.JsonRpcProvider(RPC_URL);
  const wallet     = new ethers.Wallet(PRIVATE_KEY, provider);
  const controller = new ethers.Contract(ETH_CONTROLLER, CONTROLLER_ABI, wallet);
  const registry   = new ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, wallet);

  const node      = ethers.namehash(FULL_NAME);
  const labelhash = ethers.keccak256(ethers.toUtf8Bytes(LABEL));

  console.log("\n========== MANUAL FALLBACK DATA ==========");
  console.log("Save everything below. If the script fails at any step,");
  console.log("use these values to continue manually on Etherscan.\n");
  console.log(`Wallet address    : ${wallet.address}`);
  console.log(`Name to register  : ${FULL_NAME}`);
  console.log(`Label only        : ${LABEL}`);
  console.log(`Label hash        : ${labelhash}`);
  console.log(`Name node (hash)  : ${node}`);
  console.log(`Duration (seconds): ${DURATION}  (= 1 year)`);
  console.log(`ETHController     : ${ETH_CONTROLLER}`);
  console.log(`ENS Registry      : ${ENS_REGISTRY}`);
  console.log(`Public Resolver   : ${PUBLIC_RESOLVER}`);
  console.log(`Aegis Resolver    : ${AEGIS_RESOLVER}`);
  console.log("==========================================\n");

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Balance too low. Get Sepolia ETH from sepoliafaucet.com");
    process.exit(1);
  }

  // ── 1. Availability ───────────────────────────────────────────────────────
  console.log(`\n[STEP 1] Checking availability of "${FULL_NAME}"...`);
  console.log(`→ Etherscan fallback: call available("${LABEL}") on ${ETH_CONTROLLER}`);
  const available = await controller.available(LABEL);
  console.log(`Available: ${available}`);

  if (!available) {
    const currentOwner = await registry.owner(node);
    console.log(`Already registered. Owner: ${currentOwner}`);
    if (currentOwner.toLowerCase() === wallet.address.toLowerCase()) {
      console.log("You own it. Skipping to resolver setup.");
      await setResolver(registry, wallet, node);
      return;
    } else {
      console.error(`❌ Owned by someone else: ${currentOwner}`);
      process.exit(1);
    }
  }

  // ── 2. Price ──────────────────────────────────────────────────────────────
  console.log(`\n[STEP 2] Getting rent price...`);
  console.log(`→ Etherscan fallback: call rentPrice("${LABEL}", ${DURATION}) on ${ETH_CONTROLLER}`);
  const price     = await controller.rentPrice(LABEL, DURATION);
  const totalCost = price.base + price.premium;
  const overpay   = totalCost * 110n / 100n;
  console.log(`Base price  : ${ethers.formatEther(price.base)} ETH`);
  console.log(`Premium     : ${ethers.formatEther(price.premium)} ETH`);
  console.log(`Total cost  : ${ethers.formatEther(totalCost)} ETH`);
  console.log(`Sending (+10%): ${ethers.formatEther(overpay)} ETH`);

  // ── 3. Build registration params ─────────────────────────────────────────
  const secret = ethers.hexlify(ethers.randomBytes(32));
  console.log(`\n[STEP 3] Registration parameters`);
  console.log("─────────────────────────────────────────────");
  console.log(`name              : "${LABEL}"`);
  console.log(`owner             : ${wallet.address}`);
  console.log(`duration          : ${DURATION}`);
  console.log(`secret            : ${secret}   ← SAVE THIS`);
  console.log(`resolver          : ${PUBLIC_RESOLVER}`);
  console.log(`data              : []`);
  console.log(`reverseRecord     : false`);
  console.log(`ownerControlledFuses: 0`);
  console.log("─────────────────────────────────────────────");

  const registrationParams = {
    name:                 LABEL,
    owner:                wallet.address,
    duration:             DURATION,
    secret:               secret,
    resolver:             PUBLIC_RESOLVER,
    data:                 [],
    reverseRecord:        0,              // uint8 in ENS V2 Sepolia controller
    ownerControlledFuses: ethers.ZeroHash, // bytes32 in ENS V2 Sepolia controller
  };

  // ── 4. makeCommitment ─────────────────────────────────────────────────────
  console.log(`\n[STEP 4] Computing commitment hash...`);
  console.log(`→ Etherscan fallback: call makeCommitment(tuple above) on ${ETH_CONTROLLER}`);
  let commitment: string;
  try {
    commitment = await controller.makeCommitment(registrationParams);
    console.log(`Commitment hash: ${commitment}   ← SAVE THIS`);
  } catch (e: any) {
    console.error(`\n❌ makeCommitment FAILED`);
    console.error(`Error: ${e.message}`);
    console.log(`\nManual fallback — go to Etherscan and call makeCommitment with:`);
    console.log(JSON.stringify(registrationParams, null, 2));
    process.exit(1);
  }

  // ── 5. commit() ───────────────────────────────────────────────────────────
  console.log(`\n[STEP 5] Submitting commitment...`);
  console.log(`→ Etherscan fallback: call commit("${commitment}") on ${ETH_CONTROLLER}`);
  let commitTxHash: string;
  try {
    const commitTx = await controller.commit(commitment);
    console.log(`Commit tx submitted: ${commitTx.hash}`);
    console.log(`Waiting for confirmation...`);
    await commitTx.wait();
    commitTxHash = commitTx.hash;
    console.log(`✓ Commitment confirmed: ${commitTxHash}`);
  } catch (e: any) {
    console.error(`\n❌ commit() FAILED`);
    console.error(`Error: ${e.message}`);
    console.log(`\nManual fallback — call commit on Etherscan with:`);
    console.log(`  commitment: ${commitment}`);
    process.exit(1);
  }

  // ── 6. Wait ───────────────────────────────────────────────────────────────
  const minAge = await controller.minCommitmentAge();
  const waitSec = Number(minAge) + 15;
  console.log(`\n[STEP 6] Waiting ${waitSec} seconds (minCommitmentAge = ${Number(minAge)}s + 15s buffer)...`);
  console.log(`Commitment was made at: ${new Date().toISOString()}`);
  console.log(`Register not before  : ${new Date(Date.now() + waitSec * 1000).toISOString()}`);

  for (let i = waitSec; i > 0; i--) {
    process.stdout.write(`\r  ${i}s remaining...   `);
    await sleep(1000);
  }
  console.log("\n  Ready.");

  // Verify commitment is stored on chain
  const storedCommitment = await controller.commitments(commitment);
  console.log(`On-chain commitment timestamp: ${storedCommitment.toString()}`);
  if (storedCommitment === 0n) {
    console.error("❌ Commitment not found on chain. The commit tx may not have confirmed.");
    process.exit(1);
  }

  // ── 7. register() ─────────────────────────────────────────────────────────
  console.log(`\n[STEP 7] Registering "${FULL_NAME}"...`);
  console.log(`→ Etherscan fallback: call register(tuple below) on ${ETH_CONTROLLER}`);
  console.log(`  Value to send: ${ethers.formatEther(overpay)} ETH  (${overpay.toString()} wei)`);
  console.log(`  Params:`);
  console.log(JSON.stringify(registrationParams, null, 2));

  try {
    const registerTx = await controller.register(
      registrationParams,
      { value: overpay }
    );
    console.log(`Register tx submitted: ${registerTx.hash}`);
    console.log(`Waiting for confirmation...`);
    await registerTx.wait();
    console.log(`✓ Registered. Tx: ${registerTx.hash}`);
  } catch (e: any) {
    console.error(`\n❌ register() FAILED`);
    console.error(`Error: ${e.message}`);
    console.log(`\nManual fallback — call register on Etherscan with the params above.`);
    console.log(`Make sure to send ${ethers.formatEther(overpay)} ETH with the transaction.`);
    process.exit(1);
  }

  // Confirm ownership
  const owner = await registry.owner(node);
  console.log(`\nOwner of ${FULL_NAME}: ${owner}`);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.warn(`⚠ Owner mismatch. Expected ${wallet.address}, got ${owner}`);
  }

  // ── 8. Set resolver ───────────────────────────────────────────────────────
  await setResolver(registry, wallet, node);
}

async function setResolver(
  registry: ethers.Contract,
  wallet: ethers.Wallet,
  node: string
) {
  const AEGIS_RESOLVER = process.env.AEGIS_RESOLVER_ADDRESS!;
  const FULL_NAME_LOCAL = `${LABEL}.eth`;

  console.log(`\n[STEP 8] Setting resolver to AegisENSResolver...`);
  console.log(`→ Etherscan fallback: call setResolver on ENS Registry`);
  console.log(`  Contract : ${ENS_REGISTRY}`);
  console.log(`  node     : ${node}`);
  console.log(`  resolver : ${AEGIS_RESOLVER}`);

  try {
    const tx = await registry.setResolver(node, AEGIS_RESOLVER);
    console.log(`setResolver tx submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`✓ Resolver set. Tx: ${tx.hash}`);
  } catch (e: any) {
    console.error(`\n❌ setResolver FAILED`);
    console.error(`Error: ${e.message}`);
    console.log(`\nManual fallback — call setResolver on Etherscan (ENS Registry) with:`);
    console.log(`  node     : ${node}`);
    console.log(`  resolver : ${AEGIS_RESOLVER}`);
    process.exit(1);
  }

  // Verify
  const resolverOnChain = await registry.resolver(node);
  console.log(`\nOn-chain resolver: ${resolverOnChain}`);
  if (resolverOnChain.toLowerCase() === AEGIS_RESOLVER.toLowerCase()) {
    console.log(`✓ Resolver confirmed correct.`);
  } else {
    console.warn(`⚠ Resolver mismatch. Expected ${AEGIS_RESOLVER}, got ${resolverOnChain}`);
  }

  console.log(`\n========== COMPLETE ==========`);
  console.log(`Name     : ${FULL_NAME_LOCAL}`);
  console.log(`Node     : ${node}`);
  console.log(`Resolver : ${resolverOnChain}`);
  console.log(`\nNext: run npm run ens:register-agent`);
  console.log("==============================\n");
}

main().catch(e => { console.error(e); process.exit(1); });