import React, { useEffect, useRef, useState } from "react";

const CONTRACTS = {
  factory:  "0x529754f82E4cDFc7063b944D5A1F86138B115a40",
  resolver: "0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c",
  verifier: "0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6",
};

const short = (addr: string) => addr.slice(0, 10) + "…" + addr.slice(-8);

const SIDEBAR = [
  { group: "Overview",        items: [{ id: "doc-what", label: "What is Aegis?" }, { id: "doc-security", label: "Security Model" }] },
  { group: "Getting Started", items: [{ id: "doc-install", label: "Installation" }, { id: "doc-quickstart", label: "Quick Start" }] },
  { group: "SDK Reference",   items: [{ id: "doc-wallet", label: "AegisWallet" }, { id: "doc-prover", label: "AegisProver" }, { id: "doc-ens", label: "AegisENS" }, { id: "doc-oracle", label: "QuantumOracle" }] },
  { group: "Contracts",       items: [{ id: "doc-account", label: "AegisAccount" }, { id: "doc-resolver", label: "AegisENSResolver" }] },
  { group: "ENS Guide",       items: [{ id: "doc-registration", label: "Agent Registration" }, { id: "doc-gateway", label: "CCIP-Read Gateway" }, { id: "doc-threat", label: "Threat Feed" }] },
  { group: "",                items: [{ id: "doc-contracts", label: "Deployed Contracts" }] },
];

export default function Docs() {
  const [active, setActive] = useState("doc-what");
  const [copied, setCopied] = useState<string | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const userScrollingRef = useRef(true);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const sections = content.querySelectorAll<HTMLElement>(".docs-section");
    const observer = new IntersectionObserver((entries) => {
      if (!userScrollingRef.current) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { root: content, rootMargin: "0px 0px -60% 0px", threshold: 0 });
    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    userScrollingRef.current = false;
    setTimeout(() => { userScrollingRef.current = true; }, 800);
  };

  const copyAddr = async (addr: string) => {
    try { await navigator.clipboard.writeText(addr); } catch { /* ignore */ }
    setCopied(addr);
    setTimeout(() => setCopied(null), 1500);
  };

  const { factory, resolver, verifier } = CONTRACTS;

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        {SIDEBAR.map((group, gi) => (
          <div className="sidebar-group" key={gi}>
            {group.group && <span className="sidebar-group-label">{group.group}</span>}
            {group.items.map(item => (
              <button
                key={item.id}
                className={`sidebar-btn${active === item.id ? " active" : ""}`}
                onClick={() => scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="docs-content" ref={contentRef}>

        <div className="docs-section" id="doc-what">
          <h2>What is Aegis?</h2>
          <p>Aegis is post-quantum wallet infrastructure for autonomous AI agents on Ethereum. It replaces ECDSA with ML-DSA-65 (NIST FIPS 204), compresses signatures to Groth16 ZK proofs for on-chain verification, and uses ENS as the identity and discovery layer.</p>
          <p>Every agent deployed through Aegis gets a subdomain under <code>0xaegis.eth</code>, a smart wallet that accepts ZK-verified operations, and a threat oracle that autonomously deprecates ECDSA when quantum risk crosses the threshold.</p>
        </div>

        <div className="docs-section" id="doc-security">
          <h2>Security Model</h2>
          <p>The ZK circuit proves a Poseidon commitment — not full in-circuit ML-DSA verification. The complete security model uses two layers:</p>
          <ul>
            <li><strong>Layer 1 (off-chain):</strong> ML-DSA structural validation before proof generation — length check, format check</li>
            <li><strong>Layer 2 (on-chain):</strong> Groth16 binding commitment verified via BN254 pairing — proof + pubKeyHash checked</li>
          </ul>
          <p>Full in-circuit lattice verification is planned for V2. The current model is a binding commitment: proving knowledge of <code>(sigHigh, sigLow, msgHash)</code> such that <code>Poseidon(sigHigh, sigLow, msgHash) == commitment</code>.</p>
        </div>

        <div className="docs-section" id="doc-install">
          <h2>Installation</h2>
          <pre className="docs-code">npm install @0xaegis/sdk ethers</pre>
          <p>Node.js 20+ required. The SDK bundles its own ZK circuit WASM artifacts — no separate download needed.</p>
        </div>

        <div className="docs-section" id="doc-quickstart">
          <h2>Quick Start</h2>
          <pre className="docs-code">{`import { AegisWallet, AegisProver, AegisENS, AegisGateway } from "@0xaegis/sdk";
import { ethers } from "ethers";

// 1. Generate keypair
const wallet = new AegisWallet("my-agent");

// 2. Deploy on-chain account + ENS name
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
const ens      = new AegisENS(provider, signer);
const gateway  = new AegisGateway("https://gateway.0xaegis.eth");
await ens.init();

const result = await ens.deployAgent("my-agent", signer.address, signer.address, wallet.publicKeyHash());
await gateway.registerKey("my-agent", wallet.keyPair.publicKey, "my-agent");

// 3. Sign and execute operations
const prover  = await AegisProver.create();
const message = ethers.toUtf8Bytes("transfer:0xABC:1e18:nonce:0");
const signed  = wallet.sign(message);
const proof   = await prover.prove(signed.signature, message, wallet.publicKeyHash());
const fmt     = AegisProver.formatProofForSolidity(proof.proof, proof.publicSignals);
await account.executeWithZKProof(fmt.pA, fmt.pB, fmt.pC, proof.commitment, target, value, data);`}</pre>
        </div>

        <div className="docs-section" id="doc-wallet">
          <h2>AegisWallet</h2>
          <p>Generates ML-DSA-65 keypairs and signs operations. The secret key is held in memory and should be loaded from secure storage in production — never hardcoded or logged.</p>
          <table className="docs-table">
            <thead><tr><th>Method / Property</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>new AegisWallet(agentId)</code></td><td>constructor</td><td>Generates a fresh ML-DSA-65 keypair</td></tr>
              <tr><td><code>wallet.keyPair.publicKey</code></td><td>Uint8Array</td><td>1952-byte ML-DSA public key</td></tr>
              <tr><td><code>wallet.keyPair.secretKey</code></td><td>Uint8Array</td><td>4032-byte ML-DSA secret key — store securely</td></tr>
              <tr><td><code>wallet.keyPair.publicKeyHex</code></td><td>string</td><td>Public key as 0x-prefixed hex</td></tr>
              <tr><td><code>wallet.publicKeyHash()</code></td><td>string</td><td>keccak256(publicKey) — store this on-chain</td></tr>
              <tr><td><code>wallet.sign(message, secretKey?)</code></td><td>SignedOperation</td><td>Sign with ML-DSA-65. Pass secretKey to load from secure storage.</td></tr>
              <tr><td><code>wallet.verify(message, sig)</code></td><td>boolean</td><td>Verify a signature against this wallet's public key</td></tr>
            </tbody>
          </table>
          <h3>Secret key storage</h3>
          <p>Never commit the secret key to source control. Never log it. Load it at signing time from a secrets manager (AWS Secrets Manager, Vault, GCP Secret Manager) or an encrypted environment variable injected at runtime. Back it up before calling <code>rotateKey()</code>.</p>
        </div>

        <div className="docs-section" id="doc-prover">
          <h2>AegisProver</h2>
          <p>Generates Groth16 ZK proofs that compress a 3309-byte ML-DSA signature into a 256-byte on-chain proof. First call takes 30–60s to load the WASM circuit. Subsequent calls are fast.</p>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>AegisProver.create()</code></td><td>Promise&lt;AegisProver&gt;</td><td>Initialise prover, load WASM circuit</td></tr>
              <tr><td><code>prover.prove(sig, msg, pkHash)</code></td><td>Promise&lt;ProofOutput&gt;</td><td>Generate Groth16 proof (~30–60s first run)</td></tr>
              <tr><td><code>prover.buildCommitment(sig, msg)</code></td><td>object</td><td>Compute Poseidon commitment without proving</td></tr>
              <tr><td><code>AegisProver.formatProofForSolidity(proof, signals)</code></td><td>object</td><td>Format for executeWithZKProof()</td></tr>
            </tbody>
          </table>
        </div>

        <div className="docs-section" id="doc-ens">
          <h2>AegisENS</h2>
          <p>ENS integration layer. Write methods require a Signer. Read methods work with a Provider only. Call <code>init()</code> before any write.</p>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>new AegisENS(provider, signer?)</code></td><td>Constructor — signer required for writes</td></tr>
              <tr><td><code>ens.init()</code></td><td>Initialize resolver and factory contracts</td></tr>
              <tr><td><code>ens.deployAgent(label, owner, oracle, pkHash, profile?)</code></td><td>Deploy AegisAccount + register ENS subdomain</td></tr>
              <tr><td><code>ens.registerAgent(label, address, pkHash)</code></td><td>Register ENS subdomain only</td></tr>
              <tr><td><code>ens.rotateKey(label, newPkHash)</code></td><td>Update pubKeyHash on ENS resolver</td></tr>
              <tr><td><code>ens.resolveAgent(label)</code></td><td>→ {"{ accountAddress, pubKeyHash, exists }"}</td></tr>
              <tr><td><code>ens.getAgentProfile(label)</code></td><td>→ all ENS text records</td></tr>
              <tr><td><code>ens.publishProfile(label, profile)</code></td><td>Write capability text records</td></tr>
              <tr><td><code>ens.publishThreatStatus(score, safe, factors)</code></td><td>Oracle writes to threat.0xaegis.eth</td></tr>
              <tr><td><code>ens.readThreatStatus()</code></td><td>Read oracle threat state</td></tr>
              <tr><td><code>ens.initiateHandshake(label)</code></td><td>→ {"{ nonce, pubKeyHash, accountAddress }"}</td></tr>
              <tr><td><code>ens.verifyHandshake(nonce, sig, pubKey, hash)</code></td><td>Verify PQ handshake response → boolean</td></tr>
              <tr><td><code>ens.predictAgentAddress(owner, oracle, pkHash)</code></td><td>Predict CREATE2 address before deployment</td></tr>
              <tr><td><code>ens.isAegisAccount(address)</code></td><td>Check factory provenance</td></tr>
              <tr><td><code>AegisENS.namehash(name)</code></td><td>ethers.namehash wrapper</td></tr>
              <tr><td><code>AegisENS.agentName(label)</code></td><td>"alice" → "alice.0xaegis.eth"</td></tr>
            </tbody>
          </table>
        </div>

        <div className="docs-section" id="doc-oracle">
          <h2>QuantumOracle</h2>
          <p>Threat scoring and autonomous ECDSA deprecation. Activate named threat factors to accumulate a score. When score ≥ 70, <code>shouldDeprecate()</code> returns true and <code>deprecateOnChain()</code> can be called.</p>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>new QuantumOracle()</code></td><td>Constructor</td></tr>
              <tr><td><code>oracle.activateFactor(name)</code></td><td>Activate a named threat factor</td></tr>
              <tr><td><code>oracle.getThreatScore()</code></td><td>0–100</td></tr>
              <tr><td><code>oracle.shouldDeprecate()</code></td><td>score &gt;= 70</td></tr>
              <tr><td><code>oracle.getReport()</code></td><td>Human-readable summary string</td></tr>
              <tr><td><code>oracle.deprecateOnChain(addr, signer, abi)</code></td><td>Calls deprecateECDSA() if threshold met</td></tr>
            </tbody>
          </table>
          <p>Threat factors: <code>nist_pqc_fully_deployed</code> (+30) · <code>logical_qubits_above_1000</code> (+25) · <code>secp256k1_cve_published</code> (+35) · <code>eth_core_dev_warning</code> (+10).</p>
        </div>

        <div className="docs-section" id="doc-account">
          <h2>AegisAccount</h2>
          <p>Smart wallet contract deployed per-agent via AegisFactory. Accepts two execution modes: ECDSA (deprecatable) and ZK proof (permanent).</p>
          <pre className="docs-code">{`// Key functions:
executeWithZKProof(pA, pB, pC, commitment, target, value, data)
execute(target, value, data)   // ECDSA path — disabled after deprecateECDSA()
deprecateECDSA()               // called by oracle — irreversible`}</pre>
        </div>

        <div className="docs-section" id="doc-resolver">
          <h2>AegisENSResolver</h2>
          <p>Custom CCIP-Read resolver for <code>*.0xaegis.eth</code> subdomains. Stores <code>(accountAddress, pubKeyHash, exists)</code> per ENS node on-chain. Serves full ML-DSA public keys off-chain via the CCIP-Read gateway.</p>
          <pre className="docs-code">{`registerAgent(node, accountAddress, pubKeyHash)  // owner only
rotateKey(node, newPubKeyHash)                   // owner only
getAgentRecord(node)  // → (address, bytes32, bool)
pubKey(node)          // reverts with OffchainLookup → gateway fetches key
pubKeyWithProof(result, extraData)  // verifies hash, returns full key
text(node, key)       // read text record
setText(node, key, value)
setTextBatch(node, keys[], values[])`}</pre>
        </div>

        <div className="docs-section" id="doc-registration">
          <h2>Agent Registration</h2>
          <p>Registration requires two explicit steps — on-chain and off-chain. They are separate by design: the gateway is optional infrastructure, the ENS record is permanent.</p>
          <pre className="docs-code">{`// Step 1 — on-chain: store pubKeyHash on AegisENSResolver
await ens.registerAgent("alice", accountAddress, wallet.publicKeyHash());

// Step 2 — off-chain: publish full 1952-byte key to CCIP-Read gateway
const gateway = new AegisGateway("https://gateway.0xaegis.eth");
await gateway.registerKey("alice", wallet.keyPair.publicKey, "alice");`}</pre>
          <p>The gateway verifies <code>keccak256(submittedKey) == onChainPubKeyHash</code> before storing. Only the agent that knows the real key can register.</p>
        </div>

        <div className="docs-section" id="doc-gateway">
          <h2>CCIP-Read Gateway</h2>
          <p>The gateway serves full ML-DSA public keys in response to CCIP-Read (EIP-3668) requests. When an ENS client resolves <code>alice.0xaegis.eth</code> and calls <code>pubKey(node)</code>, the resolver reverts with <code>OffchainLookup</code>. The client fetches the key here and passes it back on-chain for hash verification.</p>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td>/health</td><td>Liveness — includes key count</td></tr>
              <tr><td>GET</td><td>/ccip/:sender/:data.json</td><td>CCIP-Read key lookup</td></tr>
              <tr><td>POST</td><td>/register</td><td>Publish full ML-DSA public key</td></tr>
              <tr><td>GET</td><td>/keys</td><td>List all registered keys</td></tr>
            </tbody>
          </table>
        </div>

        <div className="docs-section" id="doc-threat">
          <h2>Threat Feed</h2>
          <p>The quantum oracle publishes live threat status to <code>threat.0xaegis.eth</code> as ENS text records. Any agent, dapp, or wallet can read it.</p>
          <pre className="docs-code">{`// Read current threat status
const status = await ens.readThreatStatus();
// → { score: 90, ecdsaSafe: false, triggeredBy: ["secp256k1_cve_published"], ... }

// Publish (oracle only)
await ens.publishThreatStatus(90, false, ["secp256k1_cve_published"]);`}</pre>
          <p>Text record keys: <code>score</code> · <code>ecdsaSafe</code> · <code>lastUpdated</code> · <code>triggeredBy</code> · <code>recommendedAction</code></p>
        </div>

        <div className="docs-section" id="doc-contracts">
          <h2>Deployed Contracts — Sepolia Testnet</h2>
          <table className="docs-table">
            <thead><tr><th>Contract</th><th>Address</th><th>Explorer</th></tr></thead>
            <tbody>
              {[
                { name: "AegisFactory",     addr: factory },
                { name: "AegisENSResolver", addr: resolver },
                { name: "Groth16Verifier",  addr: verifier },
              ].map(({ name, addr }) => (
                <tr key={addr}>
                  <td>{name}</td>
                  <td>
                    <div className="addr-row">
                      <span className="mono" style={{ fontSize: "12px" }}>{short(addr)}</span>
                      <button
                        className={`addr-copy${copied === addr ? " copied" : ""}`}
                        onClick={() => copyAddr(addr)}
                      >
                        {copied === addr ? "copied!" : "copy"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <a className="docs-link" href={`https://sepolia.etherscan.io/address/${addr}`} target="_blank" rel="noopener">Etherscan ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}
