import React, { useEffect, useRef, useState } from "react";

const TABS = [
  { label: "Wallet", file: "wallet.ts", id: "tab-0",
    html: `<span class="kw">import</span> { <span class="tp">AegisWallet</span> } <span class="kw">from</span> <span class="st">"@0xaegis/sdk"</span>;\n\n<span class="c">// Generate a post-quantum keypair — no ECDSA, no seed phrase</span>\n<span class="kw">const</span> wallet = <span class="kw">new</span> <span class="tp">AegisWallet</span>(<span class="st">"my-agent"</span>);\n\nwallet.keyPair.publicKey      <span class="c">// Uint8Array — 1952 bytes (ML-DSA-65)</span>\nwallet.keyPair.secretKey      <span class="c">// Uint8Array — 4032 bytes</span>\nwallet.<span class="fn">publicKeyHash</span>()        <span class="c">// string — keccak256, store this on-chain</span>\n\n<span class="c">// Sign any operation</span>\n<span class="kw">const</span> signed = wallet.<span class="fn">sign</span>(ethers.<span class="fn">toUtf8Bytes</span>(<span class="st">"transfer:0xABC:1e18:nonce:0"</span>));\nsigned.signature              <span class="c">// Uint8Array — 3309 bytes (never on-chain)</span>\n\n<span class="c">// Verify</span>\nwallet.<span class="fn">verify</span>(message, signed.signature) <span class="c">// boolean</span>`,
    text: `import { AegisWallet } from "@0xaegis/sdk";\n\n// Generate a post-quantum keypair — no ECDSA, no seed phrase\nconst wallet = new AegisWallet("my-agent");\n\nwallet.keyPair.publicKey      // Uint8Array — 1952 bytes (ML-DSA-65)\nwallet.keyPair.secretKey      // Uint8Array — 4032 bytes\nwallet.publicKeyHash()        // string — keccak256, store this on-chain\n\n// Sign any operation\nconst signed = wallet.sign(ethers.toUtf8Bytes("transfer:0xABC:1e18:nonce:0"));\nsigned.signature              // Uint8Array — 3309 bytes (never on-chain)\n\n// Verify\nwallet.verify(message, signed.signature) // boolean`,
  },
  { label: "Prover", file: "prover.ts", id: "tab-1",
    html: `<span class="kw">import</span> { <span class="tp">AegisProver</span> } <span class="kw">from</span> <span class="st">"@0xaegis/sdk"</span>;\n\n<span class="c">// Initialise once — loads WASM circuit</span>\n<span class="kw">const</span> prover = <span class="kw">await</span> <span class="tp">AegisProver</span>.<span class="fn">create</span>();\n\n<span class="c">// Generate a Groth16 proof (compresses 3309-byte sig → 256-byte proof)</span>\n<span class="kw">const</span> proof = <span class="kw">await</span> prover.<span class="fn">prove</span>(\n  signed.signature,       <span class="c">// private input</span>\n  message,                <span class="c">// private input</span>\n  wallet.<span class="fn">publicKeyHash</span>()\n);\n\n<span class="c">// Format for Solidity verifier</span>\n<span class="kw">const</span> { pA, pB, pC, pubSignals } = <span class="tp">AegisProver</span>.<span class="fn">formatProofForSolidity</span>(\n  proof.proof,\n  proof.publicSignals\n);\n\n<span class="c">// Submit on-chain — only the proof touches the network</span>\n<span class="kw">await</span> account.<span class="fn">executeWithZKProof</span>(pA, pB, pC, proof.commitment, target, value, data);`,
    text: `import { AegisProver } from "@0xaegis/sdk";\n\n// Initialise once — loads WASM circuit\nconst prover = await AegisProver.create();\n\n// Generate a Groth16 proof (compresses 3309-byte sig → 256-byte proof)\nconst proof = await prover.prove(\n  signed.signature,       // private input\n  message,                // private input\n  wallet.publicKeyHash()\n);\n\n// Format for Solidity verifier\nconst { pA, pB, pC, pubSignals } = AegisProver.formatProofForSolidity(\n  proof.proof,\n  proof.publicSignals\n);\n\n// Submit on-chain — only the proof touches the network\nawait account.executeWithZKProof(pA, pB, pC, proof.commitment, target, value, data);`,
  },
  { label: "ENS", file: "ens.ts", id: "tab-2",
    html: `<span class="kw">import</span> { <span class="tp">AegisENS</span>, <span class="tp">AegisGateway</span> } <span class="kw">from</span> <span class="st">"@0xaegis/sdk"</span>;\n\n<span class="kw">const</span> ens     = <span class="kw">new</span> <span class="tp">AegisENS</span>(provider, signer);\n<span class="kw">const</span> gateway = <span class="kw">new</span> <span class="tp">AegisGateway</span>(<span class="st">"https://gateway.0xaegis.eth"</span>);\n<span class="kw">await</span> ens.<span class="fn">init</span>();\n\n<span class="c">// Deploy AegisAccount + register ENS subdomain</span>\n<span class="kw">const</span> result = <span class="kw">await</span> ens.<span class="fn">deployAgent</span>(<span class="st">"alice"</span>, owner, oracle, wallet.<span class="fn">publicKeyHash</span>(), {\n  capabilities: <span class="st">"trade,escrow,price-feed"</span>,\n  endpoint:     <span class="st">"https://alice.yourapp.com/rpc"</span>,\n  price:        <span class="st">"0.001"</span>,\n  model:        <span class="st">"gpt-4o"</span>,\n  uptime:       <span class="st">"99.9"</span>,\n});\n\n<span class="c">// Publish full key to CCIP-Read gateway (explicit, not automatic)</span>\n<span class="kw">await</span> gateway.<span class="fn">registerKey</span>(<span class="st">"alice"</span>, wallet.keyPair.publicKey, <span class="st">"alice"</span>);\n\nresult.accountAddress  <span class="c">// "0xA1c3…"</span>\nresult.ensName         <span class="c">// "alice.0xaegis.eth"</span>\n\n<span class="c">// PQ handshake</span>\n<span class="kw">const</span> { nonce, pubKeyHash } = <span class="kw">await</span> ens.<span class="fn">initiateHandshake</span>(<span class="st">"alice"</span>);\n<span class="kw">const</span> valid = <span class="kw">await</span> ens.<span class="fn">verifyHandshake</span>(nonce, signature, fullPubKey, pubKeyHash);`,
    text: `import { AegisENS, AegisGateway } from "@0xaegis/sdk";\n\nconst ens     = new AegisENS(provider, signer);\nconst gateway = new AegisGateway("https://gateway.0xaegis.eth");\nawait ens.init();\n\n// Deploy AegisAccount + register ENS subdomain\nconst result = await ens.deployAgent("alice", owner, oracle, wallet.publicKeyHash(), {\n  capabilities: "trade,escrow,price-feed",\n  endpoint:     "https://alice.yourapp.com/rpc",\n  price:        "0.001",\n  model:        "gpt-4o",\n  uptime:       "99.9",\n});\n\n// Publish full key to CCIP-Read gateway (explicit, not automatic)\nawait gateway.registerKey("alice", wallet.keyPair.publicKey, "alice");\n\nresult.accountAddress  // "0xA1c3…"\nresult.ensName         // "alice.0xaegis.eth"\n\n// PQ handshake\nconst { nonce, pubKeyHash } = await ens.initiateHandshake("alice");\nconst valid = await ens.verifyHandshake(nonce, signature, fullPubKey, pubKeyHash);`,
  },
];

export default function SdkSection() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const btn = nav.querySelectorAll<HTMLElement>(".tab-btn")[active];
    if (btn) {
      indicator.style.width = btn.offsetWidth + "px";
      indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  }, [active]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    section.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const copy = async (i: number) => {
    try { await navigator.clipboard.writeText(TABS[i].text); } catch { /* ignore */ }
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section id="sdk" className="surface" ref={sectionRef}>
      <div className="container">
        <span className="section-label reveal">Developer SDK</span>
        <h2 className="section-title reveal">Three lines to integrate.</h2>
        <p className="section-sub reveal">
          <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>@0xaegis/sdk</code>
          {" "}— TypeScript-first. Tree-shakeable. Brings its own ZK circuit artifacts.
        </p>

        <div className="sdk-install reveal">
          <div className="terminal">
            <div className="terminal-header">
              <div className="tdot r" /><div className="tdot y" /><div className="tdot g" />
            </div>
            <div className="terminal-body">
              <span className="t-prompt">$ </span><span className="t-cmd">npm install @0xaegis/sdk ethers</span>
            </div>
          </div>
        </div>

        <div className="sdk-tabs reveal">
          <div className="tab-nav" ref={navRef}>
            {TABS.map((tab, i) => (
              <button
                key={i}
                className={`tab-btn${active === i ? " active" : ""}`}
                onClick={() => setActive(i)}
              >
                {tab.label}
              </button>
            ))}
            <div className="tab-indicator" ref={indicatorRef} />
          </div>

          {TABS.map((tab, i) => (
            <div key={i} className={`tab-panel code-block${active === i ? " active" : ""}`}>
              <div className="code-block-header">
                <span className="code-block-file">{tab.file}</span>
                <button className={`copy-btn${copied === i ? " copied" : ""}`} onClick={() => copy(i)}>
                  {copied === i
                    ? <><i data-lucide="check" style={{ width: "13px", height: "13px" }} /> copied</>
                    : <><i data-lucide="copy"  style={{ width: "13px", height: "13px" }} /> copy</>
                  }
                </button>
              </div>
              <pre className="code-body" dangerouslySetInnerHTML={{ __html: tab.html }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
