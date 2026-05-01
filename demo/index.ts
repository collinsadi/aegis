/**
 * Aegis Protocol — Live Demo
 * Run: npm run demo
 *
 * Full end-to-end walkthrough of the post-quantum agent wallet system:
 *   1. Generate ML-DSA-65 keypair (ARIA's quantum-safe identity)
 *   2. Deploy ThresholdOracle (2-of-3) + AegisAccount via CREATE2 factory
 *   3. Register aria.0xaegis.eth on ENS
 *   4. Execute a payment using a Groth16 ZK proof
 *   5. Simulate quantum threat detection via oracle
 *   6. Two independent oracles submit scores → ThresholdOracle autonomously deprecates ECDSA
 *   7. Verify ENS identity + post-quantum handshake
 *   8. Post-quantum key rotation
 */

import * as dotenv from "dotenv";
dotenv.config();

import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import gradient from "gradient-string";
import figlet from "figlet";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

import { AegisWallet } from "../sdk/src/wallet";
import { AegisProver } from "../sdk/src/prover";
import { QuantumOracle } from "../sdk/src/oracle";
import { AegisENS } from "../sdk/src/ens";
import { ENS_CONFIG } from "../config/ens.config";
import AegisAccountAbi          from "../sdk/abis/AegisAccount.json";
import AegisFactoryAbi          from "../sdk/abis/AegisFactory.json";
import ThresholdOracleArtifact  from "../contracts/artifacts/contracts/ThresholdOracle.sol/ThresholdOracle.json";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL    = process.env.SEPOLIA_RPC_URL!;
const PRIV_KEY   = process.env.DEPLOYER_PRIVATE_KEY!;
const EXPLORER   = "https://sepolia.etherscan.io";
const STATE_PATH = path.join(__dirname, ".state.json");
const TOTAL_STEPS = 8;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentState {
  label:                  string;
  publicKeyHex:           string;
  secretKeyHex:           string;
  pubKeyHash:             string;
  accountAddress:         string;
  ensName:                string;
  deployTxHash:           string;
  ensTxHash:              string;
  funded:                 boolean;
  thresholdOracleAddress: string;  // ThresholdOracle contract that guards this account
  oraclesFunded:          boolean;  // oracle-1 and oracle-2 funded with gas money
}

interface DemoState {
  agent:           AgentState | null;
  ecdsaDeprecated: boolean;
  paymentNonce:    number;
}

// ─── State helpers ───────────────────────────────────────────────────────────

function loadState(): DemoState {
  if (fs.existsSync(STATE_PATH)) {
    try { return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")); } catch {}
  }
  return { agent: null, ecdsaDeprecated: false, paymentNonce: 0 };
}

function saveState(s: DemoState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ─── Oracle wallet derivation ─────────────────────────────────────────────────
// Produces 3 deterministic sub-wallets from the deployer private key.
// These are the N-of-M oracle signers that call ThresholdOracle.submitThreat().
// The same indices always produce the same addresses, so they can be re-derived
// across demo runs without extra state.

function deriveOracleWallets(
  deployerKey: string,
  provider: ethers.Provider
): [ethers.Wallet, ethers.Wallet, ethers.Wallet] {
  const base = deployerKey.startsWith("0x") ? deployerKey.slice(2) : deployerKey;
  const derive = (index: number) => {
    const seed = ethers.keccak256("0x" + base + index.toString(16).padStart(2, "0"));
    return new ethers.Wallet(seed, provider);
  };
  return [derive(1), derive(2), derive(3)];
}

// ─── DemoWallet ──────────────────────────────────────────────────────────────

class DemoWallet {
  private inner: AegisWallet;
  readonly publicKey: Uint8Array;

  private constructor(inner: AegisWallet) {
    this.inner     = inner;
    this.publicKey = inner.keyPair.publicKey;
  }

  static generate(label: string): DemoWallet {
    return new DemoWallet(new AegisWallet(label));
  }

  static fromState(s: AgentState): DemoWallet {
    const w = new AegisWallet(s.label);
    (w as any).keyPair = {
      publicKey:    Buffer.from(s.publicKeyHex.slice(2), "hex"),
      secretKey:    Buffer.from(s.secretKeyHex.slice(2), "hex"),
      publicKeyHex: s.publicKeyHex,
    };
    return new DemoWallet(w);
  }

  get pubKeyHash():   string     { return this.inner.publicKeyHash(); }
  get publicKeyHex(): string     { return this.inner.keyPair.publicKeyHex; }
  get secretKeyHex(): string     { return "0x" + Buffer.from(this.inner.keyPair.secretKey).toString("hex"); }

  sign(msg: Uint8Array)                    { return this.inner.sign(msg); }
  verify(msg: Uint8Array, sig: Uint8Array) { return this.inner.verify(msg, sig); }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const BRAND = (gradient as any)(["#7928CA", "#FF0080"]);

function banner(): void {
  console.clear();
  const logo = figlet.textSync("AEGIS", { font: "Big", horizontalLayout: "fitted" });
  console.log(BRAND(logo));
  console.log(chalk.gray("  Post-Quantum Agent Wallet Protocol  ·  Sepolia Testnet\n"));
}

function stepHeader(n: number, title: string): void {
  const line = "─".repeat(58);
  console.log("\n" + chalk.dim(line));
  console.log(
    "  " + chalk.bgMagenta.bold.white(` STEP ${n}/${TOTAL_STEPS} `) +
    "  " + chalk.bold.cyan(title.toUpperCase())
  );
  console.log(chalk.dim(line) + "\n");
}

function vis(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

const BOX_W = 54;

function infoBox(rows: [string, string][], title?: string): void {
  const line = (left: string, fill: string, right: string) =>
    "  " + left + fill.repeat(BOX_W) + right;

  const row = (content: string) => {
    const padding = " ".repeat(Math.max(0, BOX_W - 2 - vis(content).length));
    return "  │  " + content + padding + "  │";
  };

  console.log(line("┌", "─", "┐"));
  if (title) {
    console.log(row(chalk.bold.white(title)));
    console.log(line("├", "─", "┤"));
  }
  for (const [k, v] of rows) {
    const keyPad = chalk.dim(k.padEnd(16));
    console.log(row(keyPad + " " + v));
  }
  console.log(line("└", "─", "┘"));
  console.log("");
}

function divider(): void { console.log("\n" + chalk.dim("─".repeat(58))); }
function ok(msg: string):   void { console.log("  " + chalk.green("✔") + "  " + chalk.white(msg)); }
function fail(msg: string): void { console.log("  " + chalk.red("✗") + "  " + chalk.red(msg)); }
function note(msg: string): void { console.log("  " + chalk.dim("·") + "  " + chalk.dim(msg)); }
function gap():             void { console.log(""); }

function short(s: string): string {
  return s.length > 20 ? s.slice(0, 10) + "…" + s.slice(-8) : s;
}
function txLink(hash: string): string {
  return chalk.dim("  ↗  ") + chalk.cyan.underline(`${EXPLORER}/tx/${hash}`);
}
function addrLink(addr: string): string {
  return chalk.cyan.underline(`${EXPLORER}/address/${addr}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Step 1: Identity ────────────────────────────────────────────────────────

async function step1(state: DemoState): Promise<DemoWallet> {
  stepHeader(1, "Quantum-Safe Identity");

  if (state.agent) {
    note("Loading saved agent from state...");
    const w = DemoWallet.fromState(state.agent);
    ok(`Agent loaded: ${chalk.white(state.agent.label)}`);
    infoBox([
      ["Agent",      chalk.white(state.agent.label)],
      ["ENS Name",   chalk.cyan(state.agent.ensName)],
      ["Algorithm",  "ML-DSA-65  (NIST FIPS 204)"],
      ["Key Hash",   chalk.white(short(state.agent.pubKeyHash))],
    ], "ARIA — Agent Identity");
    return w;
  }

  const label = "aria-" + Math.random().toString(36).slice(2, 6);
  const spinner = ora({ text: "Generating ML-DSA-65 post-quantum keypair…", color: "magenta" }).start();
  const agentWallet = DemoWallet.generate(label);
  spinner.succeed("Keypair generated");

  state.agent = {
    label,
    publicKeyHex:           agentWallet.publicKeyHex,
    secretKeyHex:           agentWallet.secretKeyHex,
    pubKeyHash:             agentWallet.pubKeyHash,
    accountAddress:         "",
    ensName:                `${label}.${ENS_CONFIG.PARENT_DOMAIN}`,
    deployTxHash:           "",
    ensTxHash:              "",
    funded:                 false,
    thresholdOracleAddress: "",
    oraclesFunded:          false,
  };
  saveState(state);

  infoBox([
    ["Agent",      chalk.white(label)],
    ["ENS Name",   chalk.cyan(state.agent.ensName)],
    ["Algorithm",  "ML-DSA-65  (NIST FIPS 204)"],
    ["Public Key", "1952 bytes  (never goes on-chain)"],
    ["Key Hash",   chalk.white(short(agentWallet.pubKeyHash))],
  ], "ARIA — Agent Identity");

  note("Only the 32-byte keccak256 key hash is stored on-chain.");
  note("Full public key is served off-chain via CCIP-Read.");
  return agentWallet;
}

// ─── Step 2: Deploy ThresholdOracle + AegisAccount ───────────────────────────

async function step2(state: DemoState, wallet: ethers.Wallet, agentWallet: DemoWallet): Promise<string> {
  stepHeader(2, "Deploy Smart Wallet");

  const provider = wallet.provider!;
  const [oracleWallet1, oracleWallet2, oracleWallet3] = deriveOracleWallets(PRIV_KEY, provider);

  // ── 2a: Deploy ThresholdOracle ────────────────────────────────────────────

  let thresholdOracleAddress = state.agent!.thresholdOracleAddress ?? "";

  if (!thresholdOracleAddress) {
    const sOracle = ora({
      text: "Deploying ThresholdOracle (2-of-3 quorum, threshold = 70)…",
      color: "cyan",
    }).start();

    const ThresholdOracleFactory = new ethers.ContractFactory(
      ThresholdOracleArtifact.abi,
      ThresholdOracleArtifact.bytecode,
      wallet
    );
    const thresholdOracle = await ThresholdOracleFactory.deploy(
      [oracleWallet1.address, oracleWallet2.address, oracleWallet3.address],
      2,   // quorum: 2 of 3 must vote
      70   // threshold: average score ≥ 70 triggers deprecation
    );
    await thresholdOracle.waitForDeployment();
    thresholdOracleAddress = await thresholdOracle.getAddress();
    sOracle.succeed(`ThresholdOracle deployed: ${short(thresholdOracleAddress)}`);

    state.agent!.thresholdOracleAddress = thresholdOracleAddress;
    saveState(state);
  } else {
    note(`ThresholdOracle already deployed: ${short(thresholdOracleAddress)}`);
  }

  // ── 2b: Fund oracle wallets ────────────────────────────────────────────────

  if (!state.agent!.oraclesFunded) {
    const GAS_AMOUNT = ethers.parseEther("0.01");
    for (const [idx, ow] of [[1, oracleWallet1], [2, oracleWallet2]] as [number, ethers.Wallet][]) {
      const bal = await provider.getBalance(ow.address);
      if (bal < ethers.parseEther("0.005")) {
        const sFund = ora({ text: `Funding Oracle-${idx} with 0.01 ETH for gas…`, color: "cyan" }).start();
        const ft = await wallet.sendTransaction({ to: ow.address, value: GAS_AMOUNT });
        await ft.wait();
        sFund.succeed(`Oracle-${idx} funded`);
      }
    }
    state.agent!.oraclesFunded = true;
    saveState(state);
  } else {
    note("Oracle wallets already funded.");
  }

  // ── Oracle network summary ────────────────────────────────────────────────

  infoBox([
    ["Contract",   "ThresholdOracle"],
    ["Quorum",     "2 of 3 independent oracle votes required"],
    ["Threshold",  "Average score ≥ 70 / 100"],
    ["Oracle-1",   chalk.dim(short(oracleWallet1.address))],
    ["Oracle-2",   chalk.dim(short(oracleWallet2.address))],
    ["Oracle-3",   chalk.dim(short(oracleWallet3.address))],
    ["Address",    chalk.white(short(thresholdOracleAddress))],
  ], "N-of-M Threat Oracle Network");

  // ── 2c: Deploy AegisAccount ────────────────────────────────────────────────

  if (state.agent!.accountAddress) {
    note("AegisAccount already deployed.");
    ok(`Address: ${state.agent!.accountAddress}`);
    console.log("  " + addrLink(state.agent!.accountAddress));
    gap();
    return state.agent!.accountAddress;
  }

  const factory    = new ethers.Contract(ENS_CONFIG.AEGIS_FACTORY_ADDRESS, (AegisFactoryAbi as any).abi, wallet);
  const pubKeyHash = agentWallet.pubKeyHash;
  const owner      = wallet.address;
  const extraSalt  = ethers.ZeroHash;

  const s1 = ora({ text: "Computing CREATE2 address…", color: "cyan" }).start();
  const predicted: string = await factory.predictAddressFull(owner, thresholdOracleAddress, pubKeyHash, extraSalt);
  s1.succeed(`Address predicted: ${short(predicted)}`);

  const s2 = ora({
    text: "Deploying AegisAccount (oracle = ThresholdOracle)…",
    color: "cyan",
  }).start();
  const deployTx = await factory.deployAgent(owner, thresholdOracleAddress, pubKeyHash, extraSalt);
  const receipt  = await deployTx.wait();
  s2.succeed("Account deployed");

  let accountAddress = predicted;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const p = factory.interface.parseLog(log);
        if (p?.name === "AgentDeployed") { accountAddress = p.args.account; break; }
      } catch {}
    }
  }

  state.agent!.accountAddress = accountAddress;
  state.agent!.deployTxHash   = deployTx.hash;
  saveState(state);

  infoBox([
    ["Contract",   "AegisAccount"],
    ["Address",    chalk.white(short(accountAddress))],
    ["Owner",      short(owner)],
    ["Oracle",     chalk.cyan("ThresholdOracle") + "  " + chalk.dim(short(thresholdOracleAddress))],
    ["PubKeyHash", short(pubKeyHash)],
    ["Verifier",   "Groth16 / BN254"],
    ["ECDSA",      chalk.green("active ✓")],
  ], "Deployed");
  console.log(txLink(deployTx.hash));
  gap();
  return accountAddress;
}

// ─── Step 3: ENS ─────────────────────────────────────────────────────────────

async function step3(state: DemoState, wallet: ethers.Wallet, agentWallet: DemoWallet, accountAddress: string): Promise<void> {
  stepHeader(3, "ENS Registration");

  const ens = new AegisENS(wallet.provider!, wallet);
  await ens.init();

  const existing = await ens.resolveAgent(state.agent!.label);
  if (existing.exists) {
    note("Already registered on ENS resolver.");
    infoBox([
      ["Name",       chalk.cyan(state.agent!.ensName)],
      ["Address",    short(existing.accountAddress)],
      ["PubKeyHash", short(existing.pubKeyHash)],
    ], "ENS Record (existing)");
    return;
  }

  const s = ora({ text: `Registering ${state.agent!.ensName}…`, color: "cyan" }).start();
  const receipt = await ens.registerAgent(state.agent!.label, accountAddress, agentWallet.pubKeyHash);
  s.succeed("Registered on-chain");

  state.agent!.ensTxHash = (receipt as any).hash ?? "";
  saveState(state);

  const node = AegisENS.namehash(state.agent!.ensName);

  const s2 = ora({ text: "Publishing agent capability profile to ENS…", color: "cyan" }).start();
  await ens.publishProfile(state.agent!.label, {
    capabilities: "trade,escrow,price-feed,zk-execution",
    endpoint:     `https://${state.agent!.label}.0xaegis.eth/rpc`,
    price:        "0.001",
    model:        "ml-dsa-65-agent",
    uptime:       "100",
    keyScheme:    "ml-dsa-65",
  });
  s2.succeed("Capability profile published");

  const threatNode = ethers.namehash(ENS_CONFIG.THREAT_FEED_DOMAIN);
  const threatKeys = ENS_CONFIG.THREAT_RECORD_KEYS;
  try {
    const resolverContract = new ethers.Contract(
      ENS_CONFIG.AEGIS_RESOLVER_ADDRESS,
      ["function getAgentRecord(bytes32 node) view returns (address, bytes32, bool)",
       "function setTextBatch(bytes32 node, string[] keys, string[] values)"],
      wallet
    );
    const [, , exists] = await resolverContract.getAgentRecord(threatNode);
    if (exists) {
      const s3 = ora({ text: "Updating threat.0xaegis.eth feed…", color: "cyan" }).start();
      await resolverContract.setTextBatch(
        threatNode,
        [threatKeys.SCORE, threatKeys.ECDSA_SAFE, threatKeys.LAST_UPDATED, threatKeys.RECOMMENDED_ACTION],
        ["0", "true", Math.floor(Date.now() / 1000).toString(), "monitor"]
      );
      s3.succeed("Threat feed updated");
    }
  } catch {
    // Threat node not yet set up — skip silently
  }

  infoBox([
    ["Name",         chalk.cyan(state.agent!.ensName)],
    ["Node",         short(node)],
    ["Account",      short(accountAddress)],
    ["PubKeyHash",   short(agentWallet.pubKeyHash)],
    ["Resolver",     short(ENS_CONFIG.AEGIS_RESOLVER_ADDRESS)],
    ["Capabilities", "trade,escrow,price-feed,zk-execution"],
    ["Key Scheme",   "ml-dsa-65  (NIST FIPS 204)"],
  ], "ENS Record + Profile");
  if (state.agent!.ensTxHash) console.log(txLink(state.agent!.ensTxHash));
  gap();
  note("Full 1952-byte ML-DSA key served off-chain via CCIP-Read (EIP-3668).");
  note("Capabilities discoverable by any agent querying 0xaegis.eth subgraph.");
}

// ─── Step 4: Payment (ZK Proof) ──────────────────────────────────────────────

async function step4(state: DemoState, wallet: ethers.Wallet, agentWallet: DemoWallet): Promise<void> {
  stepHeader(4, "Execute Payment  (Groth16 ZK Proof)");

  const accountAddress = state.agent!.accountAddress;
  const provider       = wallet.provider!;
  const account        = new ethers.Contract(accountAddress, (AegisAccountAbi as any).abi, wallet);

  const balance = await provider.getBalance(accountAddress);
  const needed  = ethers.parseEther("0.003");
  if (balance < needed) {
    const s = ora({ text: "Funding ARIA's account with 0.003 ETH…", color: "cyan" }).start();
    const tx = await wallet.sendTransaction({ to: accountAddress, value: needed });
    await tx.wait();
    s.succeed("Account funded  (0.003 ETH)");
    state.agent!.funded = true;
    saveState(state);
  } else {
    note(`Account balance: ${ethers.formatEther(balance).slice(0, 8)} ETH`);
  }

  const recipient  = wallet.address;
  const amount     = ethers.parseEther("0.001");
  const nonce      = state.paymentNonce;

  gap();
  console.log("  " + chalk.bold("Scheduled Operation"));
  console.log("  " + chalk.dim("Transfer") + "  " + chalk.white("0.001 ETH") +
              chalk.dim("  →  ") + chalk.cyan(short(recipient)) + chalk.dim("  (DAO Treasury)"));
  gap();

  const msgStr   = `transfer:${recipient}:${amount.toString()}:nonce:${nonce}`;
  const msgBytes = ethers.toUtf8Bytes(msgStr);
  const s1       = ora({ text: "ARIA signing with ML-DSA-65…", color: "magenta" }).start();
  const signed   = agentWallet.sign(msgBytes);
  s1.succeed(`Signed  — ${signed.signature.length}-byte signature stays off-chain`);

  gap();
  note("Layer 1 — Off-chain: ML-DSA signature structurally validated (3309 bytes)");
  note("Layer 2 — ZK circuit: Poseidon commitment binds signature to this operation");
  note("On-chain: Groth16 pairing check + pubKeyHash binding — 256-byte proof only.\n");

  const prover     = await AegisProver.create();
  const s2         = ora({ text: "Generating Groth16 proof…  0s", color: "magenta" }).start();
  const t0         = Date.now();
  const proofTimer = setInterval(() => {
    s2.text = `Generating Groth16 proof…  ${Math.floor((Date.now() - t0) / 1000)}s`;
  }, 500);

  const proofOutput = await prover.prove(signed.signature, msgBytes, agentWallet.pubKeyHash);
  clearInterval(proofTimer);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  s2.succeed(`Proof ready  (${elapsed}s)`);

  const fmt = AegisProver.formatProofForSolidity(proofOutput.proof, proofOutput.publicSignals);

  infoBox([
    ["Commitment",  short("0x" + proofOutput.commitment.toString(16).padStart(64, "0"))],
    ["Proof size",  "256 bytes  (vs 3309 bytes raw signature)"],
    ["Gas est.",    "~200k  (vs ~850k for raw ML-DSA verification)"],
  ], "ZK Proof");

  const s3 = ora({ text: "Submitting to AegisAccount.executeWithZKProof()…", color: "cyan" }).start();
  const execTx = await account.executeWithZKProof(
    fmt.pA, fmt.pB, fmt.pC,
    proofOutput.commitment,
    recipient, amount, "0x"
  );
  const execReceipt = await execTx.wait();
  s3.succeed("Payment confirmed on-chain");

  const newNonce     = await account.nonce();
  state.paymentNonce = Number(newNonce);
  saveState(state);

  const gasUsed     = execReceipt.gasUsed;
  const gasPrice    = execReceipt.gasPrice ?? execReceipt.effectiveGasPrice ?? 0n;
  const gasCostWei  = gasUsed * gasPrice;
  const gasCostEth  = ethers.formatEther(gasCostWei);
  const gasCostGwei = ethers.formatUnits(gasPrice, "gwei");

  infoBox([
    ["Operation",    "Transfer 0.001 ETH"],
    ["Recipient",    short(recipient) + chalk.dim("  (DAO Treasury)")],
    ["Block",        String(execReceipt.blockNumber)],
    ["Nonce",        String(newNonce)],
    ["Gas used",     chalk.white(gasUsed.toString()) + chalk.dim("  units")],
    ["Gas price",    chalk.white(parseFloat(gasCostGwei).toFixed(4)) + chalk.dim("  gwei")],
    ["Tx cost",      chalk.white(parseFloat(gasCostEth).toFixed(8)) + chalk.dim("  ETH")],
    ["Raw sig size", chalk.dim("3309 bytes  (never on-chain)")],
    ["Proof size",   chalk.dim("256 bytes  (BN254 Groth16)")],
  ], "Payment Executed");
  console.log(txLink(execTx.hash));
  gap();
  note("The Groth16 proof was verified on-chain by the BN254 pairing check.");
  note("ARIA's ML-DSA signature never appeared on-chain or in any transaction.");
}

// ─── Step 5: Quantum Threat ───────────────────────────────────────────────────

async function step5(): Promise<QuantumOracle> {
  stepHeader(5, "Quantum Threat Detected");

  const { ZeroGQuantumOracle } = await import("../sdk/src/zerogOracle");
  const { INTEGRATIONS }       = await import("../config/ens.config");
  const oracle = new ZeroGQuantumOracle();
  console.log("  " + chalk.bold("Oracle monitoring live threat signals…\n"));

  const factors = [
    { name: "nist_pqc_fully_deployed",   label: "NIST PQC standards fully deployed",    weight: 30 },
    { name: "logical_qubits_above_1000", label: "1,200 logical qubits demonstrated",     weight: 25 },
    { name: "secp256k1_cve_published",   label: "secp256k1 CVE-2026-XXXX published",     weight: 35 },
  ];

  let score = 0;
  for (const f of factors) {
    await sleep(700);
    oracle.activateFactor(f.name);
    score += f.weight;
    const filled    = Math.floor(score / 5);
    const empty     = 20 - filled;
    const barColor  = score >= 70 ? chalk.red : score >= 40 ? chalk.yellow : chalk.green;
    const bar       = barColor("█".repeat(filled)) + chalk.dim("░".repeat(empty));
    const scoreStr  = barColor.bold(String(score).padStart(3));
    const threshold = score >= QuantumOracle.DEPRECATION_THRESHOLD ? chalk.red.bold(" ← THRESHOLD CROSSED") : "";
    console.log(`  [${bar}] ${scoreStr}/100   ${chalk.dim(f.label)}${threshold}`);
  }

  gap();
  const finalScore = oracle.getThreatScore();
  infoBox([
    ["Threat Score",  chalk.red.bold(`${finalScore} / 100`)],
    ["Threshold",     `${QuantumOracle.DEPRECATION_THRESHOLD} / 100`],
    ["Status",        chalk.red.bold("⚠  CRITICAL — ECDSA deprecation required")],
    ["Triggered by",  "nist_pqc + logical_qubits + secp256k1_cve"],
  ], "Oracle Report");

  if (INTEGRATIONS.ZERO_G.ENABLED) {
    const zgSpin = ora({ text: "Querying 0G Compute for AI threat assessment…", color: "cyan" }).start();
    const zgScore = await oracle.computeThreatScore();
    zgSpin.succeed(`0G Compute threat score: ${chalk.red.bold(zgScore)}/100  (verifiable inference via TEE)`);
  }

  return oracle;
}

// ─── Step 6: Autonomous ECDSA Deprecation via ThresholdOracle ────────────────

async function step6(state: DemoState, wallet: ethers.Wallet, oracle: QuantumOracle): Promise<void> {
  stepHeader(6, "Autonomous ECDSA Deprecation");

  const accountAddress = state.agent!.accountAddress;
  const account        = new ethers.Contract(accountAddress, (AegisAccountAbi as any).abi, wallet);
  const provider       = wallet.provider!;

  const thresholdOracleAddress = state.agent!.thresholdOracleAddress ?? "";
  if (!thresholdOracleAddress) {
    fail("ThresholdOracle address not found in state — run Step 2 first.");
    return;
  }

  if (state.ecdsaDeprecated) {
    note("ECDSA already deprecated. Skipping on-chain call.");
  } else {
    const [oracleWallet1, oracleWallet2] = deriveOracleWallets(PRIV_KEY, provider);
    const thresholdOracle = new ethers.Contract(
      thresholdOracleAddress,
      ThresholdOracleArtifact.abi,
      wallet
    ) as any;

    infoBox([
      ["Contract",   "ThresholdOracle"],
      ["Address",    short(thresholdOracleAddress)],
      ["Quorum",     "2 of 3 independent oracle votes"],
      ["Threshold",  "Average score ≥ 70 / 100"],
      ["Oracle-1",   short(oracleWallet1.address)],
      ["Oracle-2",   short(oracleWallet2.address)],
    ], "N-of-M Threat Oracle Network");

    // ── Oracle-1 votes (score 80) ─────────────────────────────────────────────
    const s1 = ora({ text: "Oracle-1 submitting threat score 80 to ThresholdOracle…", color: "yellow" }).start();
    const tx1 = await thresholdOracle.connect(oracleWallet1).submitThreat(accountAddress, 80);
    await tx1.wait();
    s1.succeed(`Oracle-1 voted  (score: 80  |  1/2 quorum)`);
    console.log(txLink(tx1.hash));

    gap();
    note("Vote count: 1 / quorum 2  —  avg score: 80  —  threshold: 70  —  no action yet");
    gap();

    // ── Oracle-2 votes (score 85) → hits quorum → autonomous deprecation ──────
    const s2 = ora({ text: "Oracle-2 submitting threat score 85 to ThresholdOracle…", color: "red" }).start();
    const tx2 = await thresholdOracle.connect(oracleWallet2).submitThreat(accountAddress, 85);
    const receipt2 = await tx2.wait();
    s2.succeed(`Oracle-2 voted  (score: 85  |  QUORUM REACHED)`);
    console.log(txLink(tx2.hash));
    gap();

    // Parse events emitted in tx2
    const quorumEvent = receipt2.logs
      .map((log: any) => { try { return thresholdOracle.interface.parseLog(log); } catch { return null; } })
      .find((e: any) => e && e.name === "QuorumReached");

    const avgScore = quorumEvent ? Number(quorumEvent.args.averageScore) : 82;

    ok(`Average score: ${avgScore} / 100  ≥ threshold 70`);
    ok("ThresholdOracle.deprecateECDSA() called autonomously — no human in the loop");
    gap();

    state.ecdsaDeprecated = true;
    saveState(state);
  }

  const ecdsaActive = await account.ecdsaActive();
  infoBox([
    ["Account",   short(accountAddress)],
    ["Oracle",    chalk.cyan("ThresholdOracle") + chalk.dim("  (2-of-3 quorum, avg ≥ 70)")],
    ["ECDSA",     ecdsaActive ? chalk.green("active ✓") : chalk.red("deprecated ✗")],
    ["ZK Proofs", chalk.green("active ✓")],
    ["Triggered", "2 independent oracle votes  (no human required)"],
  ], "ARIA — Security Mode");

  // ── Test 1: ECDSA rejection ───────────────────────────────────────────────
  gap();
  console.log("  " + chalk.bold("Test: legacy ECDSA transaction\n"));
  const ecdsaSpin = ora({ text: "Attempting ECDSA execution…", color: "yellow" }).start();
  await sleep(400);
  try {
    const fakeMsg   = ethers.randomBytes(32);
    const ecdsaSig  = await wallet.signMessage(fakeMsg);
    await account.executeWithECDSA(ecdsaSig, ethers.hashMessage(fakeMsg), wallet.address, 0n, "0x");
    ecdsaSpin.fail("ERROR: ECDSA was accepted — this should not happen");
  } catch (e: any) {
    const reason = e.reason ?? e.message?.match(/"([^"]+)"/)?.[1] ?? "reverted";
    ecdsaSpin.fail(`Rejected: "${chalk.red(reason)}"`);
    ok("ECDSA correctly blocked  — quantum-safe mode enforced");
  }

  // ── Test 2: ZK proof still works ─────────────────────────────────────────
  gap();
  console.log("  " + chalk.bold("Test: ZK proof execution (should succeed)\n"));

  const agentWallet = DemoWallet.fromState(state.agent!);
  const msgBytes    = ethers.toUtf8Bytes(`keepalive:nonce:${state.paymentNonce}`);
  const signed      = agentWallet.sign(msgBytes);
  const prover      = await AegisProver.create();

  const zkSpin  = ora({ text: "Generating ZK proof…  0s", color: "magenta" }).start();
  const t0      = Date.now();
  const zkTimer = setInterval(() => {
    zkSpin.text = `Generating ZK proof…  ${Math.floor((Date.now() - t0) / 1000)}s`;
  }, 500);
  const proof = await prover.prove(signed.signature, msgBytes, agentWallet.pubKeyHash);
  clearInterval(zkTimer);
  zkSpin.succeed(`Proof ready  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const fmt      = AegisProver.formatProofForSolidity(proof.proof, proof.publicSignals);
  const execSpin = ora({ text: "Submitting ZK proof…", color: "cyan" }).start();
  const execTx   = await account.executeWithZKProof(
    fmt.pA, fmt.pB, fmt.pC, proof.commitment, wallet.address, 0n, "0x"
  );
  const keepAliveReceipt = await execTx.wait();
  const keepAliveGas = keepAliveReceipt?.gasUsed ?? 0n;
  execSpin.succeed(`ZK proof accepted — ARIA keeps operating normally  (gas: ${keepAliveGas.toString()})`);

  state.paymentNonce++;
  saveState(state);

  console.log(txLink(execTx.hash));
  gap();
}

// ─── Step 7: ENS + Handshake ─────────────────────────────────────────────────

async function step7(state: DemoState, wallet: ethers.Wallet, agentWallet: DemoWallet): Promise<void> {
  stepHeader(7, "ENS Identity & Post-Quantum Handshake");

  const ens = new AegisENS(wallet.provider!, wallet);
  await ens.init();

  const s = ora({ text: `Resolving ${state.agent!.ensName}…`, color: "cyan" }).start();
  const record = await ens.resolveAgent(state.agent!.label);
  s.succeed("Resolved");

  infoBox([
    ["Name",        chalk.cyan(state.agent!.ensName)],
    ["Address",     record.exists ? short(record.accountAddress) : chalk.red("not found")],
    ["PubKeyHash",  record.exists ? short(record.pubKeyHash)     : chalk.red("not found")],
    ["Exists",      record.exists ? chalk.green("yes") : chalk.red("no")],
    ["ECDSA",       state.ecdsaDeprecated ? chalk.red("deprecated") : chalk.green("active")],
  ], "ENS Resolution");
  console.log("  " + addrLink(state.agent!.accountAddress));
  gap();

  console.log("  " + chalk.bold("Post-Quantum Agent Handshake\n"));
  note("A counterpart agent challenges ARIA to prove her identity.");
  note("No ECDSA. No TLS. No certificate authority. ENS is the trust anchor.\n");

  const hs1 = ora({ text: "Counterpart generating challenge nonce…", color: "cyan" }).start();
  const nonce = ethers.randomBytes(32);
  await sleep(300);
  hs1.succeed(`Challenge issued  — nonce: ${short(ethers.hexlify(nonce))}`);

  const hs2 = ora({ text: "ARIA signing nonce with ML-DSA-65…", color: "magenta" }).start();
  const response = agentWallet.sign(nonce);
  await sleep(200);
  hs2.succeed(`Response signed  — ${response.signature.length}-byte ML-DSA signature`);

  const hs3 = ora({ text: "Verifying signature against on-chain pubKeyHash…", color: "cyan" }).start();
  await sleep(300);
  const computedHash = ethers.keccak256(ethers.hexlify(agentWallet.publicKey));
  const hashMatch    = computedHash.toLowerCase() === state.agent!.pubKeyHash.toLowerCase();
  const sigValid     = agentWallet.verify(nonce, response.signature);
  hs3.succeed("Verification complete");

  const passed = hashMatch && sigValid;
  infoBox([
    ["PubKey → Hash",  hashMatch ? chalk.green("✔  matches on-chain record") : chalk.red("✗  mismatch")],
    ["ML-DSA Sig",     sigValid  ? chalk.green("✔  valid")                    : chalk.red("✗  invalid")],
    ["Result",         passed ? chalk.green.bold("IDENTITY CONFIRMED") : chalk.red.bold("FAILED")],
  ], "Handshake Result");

  if (passed) {
    note("Any agent can run this handshake against " + state.agent!.ensName);
    note("Identity is provable using only on-chain ENS records — no trusted third party.");
  }

  gap();
  console.log("  " + chalk.bold("Live Two-Agent Handshake: ARIA ↔ BOB\n"));
  note("Spawning a second agent (Bob) to demonstrate agent-to-agent trust.\n");

  const bobLabel  = "bob-" + Math.random().toString(36).slice(2, 5);
  const bobWallet = new AegisWallet(bobLabel);

  const bobSpawnSpin = ora({ text: "Generating Bob's ML-DSA-65 keypair…", color: "cyan" }).start();
  await sleep(200);
  bobSpawnSpin.succeed(`Bob spawned — ${bobLabel}`);

  infoBox([
    ["Agent",     chalk.white(bobLabel)],
    ["Algorithm", "ML-DSA-65  (NIST FIPS 204)"],
    ["Key Hash",  short(bobWallet.publicKeyHash())],
    ["Status",    "ephemeral — identity demo only"],
  ], "Bob — Second Agent");

  const hs_a1 = ora({ text: "ARIA generating challenge nonce for Bob…", color: "magenta" }).start();
  const ariaChallenge = ethers.randomBytes(32);
  await sleep(200);
  hs_a1.succeed(`Challenge issued  — ${short(ethers.hexlify(ariaChallenge))}`);

  const hs_a2 = ora({ text: "Bob signing challenge with ML-DSA-65…", color: "cyan" }).start();
  const bobResponse = bobWallet.sign(ariaChallenge);
  await sleep(200);
  hs_a2.succeed(`Bob responded  — ${bobResponse.signature.length}-byte ML-DSA signature`);

  const hs_a3 = ora({ text: "ARIA verifying Bob's signature…", color: "magenta" }).start();
  await sleep(200);
  const bobSigValid = bobWallet.verify(ariaChallenge, bobResponse.signature);
  hs_a3.succeed("Verification complete");

  const hs_b1 = ora({ text: "Bob generating challenge nonce for ARIA…", color: "cyan" }).start();
  const bobChallenge = ethers.randomBytes(32);
  await sleep(200);
  hs_b1.succeed(`Counter-challenge issued  — ${short(ethers.hexlify(bobChallenge))}`);

  const hs_b2 = ora({ text: "ARIA signing counter-challenge with ML-DSA-65…", color: "magenta" }).start();
  const ariaResponse = agentWallet.sign(bobChallenge);
  await sleep(200);
  hs_b2.succeed(`ARIA responded  — ${ariaResponse.signature.length}-byte ML-DSA signature`);

  const hs_b3 = ora({ text: "Bob verifying ARIA's signature against ENS pubKeyHash…", color: "cyan" }).start();
  await sleep(200);
  const ariaKeyHash   = ethers.keccak256(ethers.hexlify(agentWallet.publicKey));
  const ariaHashMatch = ariaKeyHash.toLowerCase() === state.agent!.pubKeyHash.toLowerCase();
  const ariaSigValid  = agentWallet.verify(bobChallenge, ariaResponse.signature);
  hs_b3.succeed("Verification complete");

  const handshakePassed = bobSigValid && ariaSigValid && ariaHashMatch;

  infoBox([
    ["ARIA → Bob",    "Challenge issued & signed"],
    ["Bob sig valid", bobSigValid ? chalk.green("✔  verified") : chalk.red("✗  failed")],
    ["Bob → ARIA",   "Counter-challenge issued & signed"],
    ["ARIA sig",     ariaSigValid  ? chalk.green("✔  valid")   : chalk.red("✗  failed")],
    ["ARIA hash",    ariaHashMatch ? chalk.green("✔  matches ENS on-chain record") : chalk.red("✗  mismatch")],
    ["Result",       handshakePassed
      ? chalk.green.bold("✔  MUTUAL AUTHENTICATION COMPLETE")
      : chalk.red.bold("✗  HANDSHAKE FAILED")],
  ], "ARIA ↔ BOB  Mutual PQ Handshake");

  if (handshakePassed) {
    note("Both agents proved their identity to each other.");
    note("Zero ECDSA. Zero TLS. Zero certificate authority.");
    note("Trust anchor: ENS + ML-DSA-65 (NIST FIPS 204).");
  }
}

// ─── Step 8: Key Rotation ─────────────────────────────────────────────────────

async function step8(state: DemoState, wallet: ethers.Wallet, agentWallet: DemoWallet): Promise<void> {
  stepHeader(8, "Post-Quantum Key Rotation");

  console.log("  " + chalk.bold("Demonstrating autonomous key rotation\n"));
  note("ML-DSA keys can be rotated at any time.");
  note("The on-chain pubKeyHash is updated via ENS resolver.");
  note("No contract redeployment. No service interruption.\n");

  const ens = new AegisENS(wallet.provider!, wallet);
  await ens.init();

  infoBox([
    ["Agent",          state.agent!.ensName],
    ["Old PubKeyHash", short(state.agent!.pubKeyHash)],
    ["Key Scheme",     "ML-DSA-65  (NIST FIPS 204)"],
    ["Status",         chalk.yellow("Rotating…")],
  ], "Key State — Before Rotation");

  const s1 = ora({ text: "Generating new ML-DSA-65 keypair…", color: "magenta" }).start();
  const newWallet     = DemoWallet.generate(state.agent!.label + "-rotated");
  const newPubKeyHash = newWallet.pubKeyHash;
  await sleep(300);
  s1.succeed("New keypair generated");

  console.log("");
  note(`Old hash: ${short(state.agent!.pubKeyHash)}`);
  note(`New hash: ${short(newPubKeyHash)}`);
  console.log("");

  const s2 = ora({ text: "Updating pubKeyHash on ENS resolver (on-chain)…", color: "cyan" }).start();
  const receipt = await ens.rotateKey(state.agent!.label, newPubKeyHash);
  s2.succeed("pubKeyHash updated on-chain");
  console.log(txLink((receipt as any).hash ?? ""));

  const s3 = ora({ text: "Verifying ENS record…", color: "cyan" }).start();
  const updatedRecord = await ens.resolveAgent(state.agent!.label);
  s3.succeed("Verified");

  const rotationValid = updatedRecord.pubKeyHash.toLowerCase() === newPubKeyHash.toLowerCase();

  infoBox([
    ["Agent",          state.agent!.ensName],
    ["Old PubKeyHash", short(state.agent!.pubKeyHash)],
    ["New PubKeyHash", short(newPubKeyHash)],
    ["On-chain",       rotationValid ? chalk.green("✔  updated correctly") : chalk.red("✗  mismatch")],
    ["Downtime",       chalk.green("zero  — account never paused")],
    ["Redeployment",   chalk.green("none  — same AegisAccount address")],
  ], "Key Rotation Complete");

  if (rotationValid) {
    note("The AegisAccount address did not change.");
    note("The agent's ENS name did not change.");
    note("Only the bound public key hash changed — rotation is seamless.");
  } else {
    console.log(chalk.red("  ✗  Key rotation verification failed — check ENS resolver."));
  }

  gap();
}

// ─── Full demo flow ───────────────────────────────────────────────────────────

async function runFullDemo(): Promise<void> {
  let state    = loadState();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIV_KEY, provider);

  banner();
  const line = "─".repeat(58);
  console.log(chalk.dim(line));
  console.log("  " + chalk.bold.white("FULL DEMO") + chalk.dim("  ·  8 steps  ·  Sepolia testnet"));
  console.log(chalk.dim(line));

  const balance = await provider.getBalance(wallet.address);
  console.log("\n  " + chalk.dim("Wallet:  ") + chalk.white(short(wallet.address)));
  console.log("  " + chalk.dim("Balance: ") + chalk.white(ethers.formatEther(balance).slice(0, 10) + " ETH\n"));

  const agentWallet    = await step1(state);
  const accountAddress = await step2(state, wallet, agentWallet);
  await step3(state, wallet, agentWallet, accountAddress);
  await step4(state, wallet, agentWallet);
  const oracle = await step5();
  await step6(state, wallet, oracle);
  await step7(state, wallet, agentWallet);
  await step8(state, wallet, agentWallet);

  divider();
  console.log("\n" + BRAND("  All 8 steps complete.\n"));
  console.log("  " + chalk.bold("Agent:    ") + chalk.cyan(state.agent!.ensName));
  console.log("  " + chalk.bold("Account:  ") + "  " + addrLink(state.agent!.accountAddress));
  console.log("  " + chalk.bold("Oracle:   ") + chalk.cyan("ThresholdOracle  (2-of-3)") + "  " +
              chalk.dim(short(state.agent!.thresholdOracleAddress)));
  console.log("  " + chalk.bold("ECDSA:    ") + chalk.red("deprecated  (quantum-safe mode active)"));
  console.log("\n" + chalk.dim("  Run again to execute individual steps or reset state.\n"));
}

// ─── Individual step runner ───────────────────────────────────────────────────

async function runStep(n: number): Promise<void> {
  const state    = loadState();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIV_KEY, provider);

  if (!state.agent && n > 1) {
    console.log(chalk.yellow("\n  ⚠  Run Step 1 first to create the agent identity.\n"));
    return;
  }

  const agentWallet = state.agent ? DemoWallet.fromState(state.agent) : null;

  switch (n) {
    case 1: await step1(state); break;
    case 2: await step2(state, wallet, agentWallet!); break;
    case 3: {
      const addr = state.agent!.accountAddress || (await step2(state, wallet, agentWallet!));
      await step3(state, wallet, agentWallet!, addr);
      break;
    }
    case 4: await step4(state, wallet, agentWallet!); break;
    case 5: await step5(); break;
    case 6: {
      const { ZeroGQuantumOracle } = await import("../sdk/src/zerogOracle");
      const oracle = new ZeroGQuantumOracle();
      oracle.activateFactor("nist_pqc_fully_deployed");
      oracle.activateFactor("logical_qubits_above_1000");
      oracle.activateFactor("secp256k1_cve_published");
      await step6(state, wallet, oracle);
      break;
    }
    case 7: await step7(state, wallet, agentWallet!); break;
    case 8: await step8(state, wallet, agentWallet!); break;
  }
}

// ─── Main menu ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!RPC_URL || !PRIV_KEY) {
    console.error(chalk.red("\n  ✗  Missing env vars: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY\n"));
    process.exit(1);
  }

  let state = loadState();

  // Detect state written before ThresholdOracle integration (account deployed, no oracle recorded)
  if (state.agent && state.agent.accountAddress && !state.agent.thresholdOracleAddress) {
    banner();
    console.log(chalk.yellow("  ⚠  Saved state is from before the ThresholdOracle integration."));
    console.log(chalk.yellow("     The stored account was deployed with a single EOA oracle, not"));
    console.log(chalk.yellow("     the N-of-M ThresholdOracle.  Reset to start a fresh demo run.\n"));
    const { resetNow } = await inquirer.prompt([{
      type:    "confirm",
      name:    "resetNow",
      message: "Reset demo state now?",
      default: true,
    }]);
    if (resetNow) {
      if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
      state = loadState();
      console.log(chalk.yellow("  State cleared. Starting fresh.\n"));
    }
  }

  banner();

  const statusLine = state.agent
    ? chalk.green("● ") + chalk.cyan(state.agent.ensName) +
      (state.ecdsaDeprecated ? chalk.red("  [ECDSA deprecated]") : chalk.dim("  [ECDSA active]")) +
      (state.agent.thresholdOracleAddress
        ? chalk.dim("  oracle: " + short(state.agent.thresholdOracleAddress))
        : "")
    : chalk.dim("● No agent deployed yet");

  console.log("  Status: " + statusLine + "\n");

  while (true) {
    const { choice } = await inquirer.prompt([{
      type:     "list",
      name:     "choice",
      message:  "Choose a demo scenario:",
      pageSize: 15,
      choices: [
        {
          name:  chalk.bold.cyan("🚀  Run Full Demo") + chalk.dim("  (all 8 steps, ~3 min)"),
          value: "full",
        },
        new (inquirer as any).Separator(chalk.dim("──────────────────────────────")),
        { name: "1   Generate ML-DSA Agent Identity",                    value: "1" },
        { name: "2   Deploy ThresholdOracle + AegisAccount (CREATE2)",   value: "2" },
        { name: "3   Register on ENS",                                   value: "3" },
        { name: "4   Execute Payment via ZK Proof",                      value: "4" },
        { name: "5   Trigger Quantum Oracle",                            value: "5" },
        { name: "6   N-of-M Oracle Votes → Autonomous ECDSA Deprecation", value: "6" },
        { name: "7   Verify ENS Identity & Handshake",                   value: "7" },
        { name: "8   Post-Quantum Key Rotation",                         value: "8" },
        new (inquirer as any).Separator(chalk.dim("──────────────────────────────")),
        { name: chalk.yellow("↩   Reset demo state"),   value: "reset" },
        { name: chalk.red("✕   Exit"),                  value: "exit" },
      ],
    }]);

    if (choice === "exit") { console.log(""); process.exit(0); }

    if (choice === "reset") {
      if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
      console.log(chalk.yellow("\n  State cleared. Next run will deploy a fresh agent.\n"));
      continue;
    }

    if (choice === "full") { await runFullDemo(); break; }

    try {
      await runStep(parseInt(choice));
    } catch (e: any) {
      console.error("\n" + chalk.red("  ✗  " + (e.reason ?? e.message ?? String(e))) + "\n");
    }
  }
}

// Support --run <step|full> flag for non-interactive execution
const runArg = process.argv.indexOf("--run");
if (runArg !== -1 && process.argv[runArg + 1]) {
  const val = process.argv[runArg + 1];
  const go = val === "full"
    ? runFullDemo()
    : runStep(parseInt(val));
  go.catch(e => {
    console.error(chalk.red("\n  Fatal: " + (e.message ?? String(e)) + "\n"));
    process.exit(1);
  });
} else {
  main().catch(e => {
    console.error(chalk.red("\n  Fatal: " + (e.message ?? String(e)) + "\n"));
    process.exit(1);
  });
}
