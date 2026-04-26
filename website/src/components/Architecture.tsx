import React, { useEffect, useRef } from "react";

function Terminal({ html }: { html: string }) {
  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="tdot r" /><div className="tdot y" /><div className="tdot g" />
      </div>
      <div className="terminal-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const STEPS = [
  {
    num: "01", tag: "NIST FIPS 204", title: "ML-DSA Keypair",
    body: `Agent spawns with a CRYSTALS-Dilithium ML-DSA-65 keypair. 1952-byte public key. Hardened against Shor's algorithm. The full key never goes on-chain — only its 32-byte keccak256 hash is stored.`,
    hasLine: true,
    terminal: `<span class="t-prompt">$ </span><span class="t-cmd">const wallet = new AegisWallet("my-agent")</span>\n<span class="t-prompt">&gt; </span><span class="t-key">pubKey:    </span><span class="t-val">1952 bytes</span>  <span class="t-dim">(ML-DSA-65)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">secretKey: </span><span class="t-val">4032 bytes</span>\n<span class="t-prompt">&gt; </span><span class="t-key">keyHash:   </span><span class="t-val">0x7f3a…</span>    <span class="t-dim">(stored on-chain)</span>`,
  },
  {
    num: "02", tag: "Groth16 · BN254", title: "ZK Compression",
    body: `A 3309-byte ML-DSA signature is compressed off-chain into a 256-byte Groth16 proof via a Poseidon commitment circuit. On-chain verification costs ~200k gas — comparable to what projects pay for ECDSA today.`,
    hasLine: true,
    terminal: `<span class="t-prompt">$ </span><span class="t-cmd">const proof = await prover.prove(sig, message, keyHash)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">proof:    </span><span class="t-val">256 bytes</span>   <span class="t-dim">(Groth16)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">gas:      </span><span class="t-val">~200,000</span>    <span class="t-dim">(BN254 pairing)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">raw sig:  </span><span class="t-val">3309 bytes</span>  <span class="t-dim">(never on-chain)</span>`,
  },
  {
    num: "03", tag: "EIP-3668 CCIP-Read", title: "ENS Identity",
    body: null,
    hasLine: true,
    terminal: `<span class="t-prompt">$ </span><span class="t-cmd">resolve("alice.0xaegis.eth")</span>\n<span class="t-prompt">&gt; </span><span class="t-key">address:    </span><span class="t-val">0xA1c3…</span>     <span class="t-dim">(AegisAccount)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">pubKeyHash: </span><span class="t-val">0x7f3a…</span>     <span class="t-dim">(on-chain)</span>\n<span class="t-prompt">&gt; </span><span class="t-key">pubKey:     </span><span class="t-val">1952 bytes</span>  <span class="t-dim">(CCIP-Read gateway)</span>`,
  },
  {
    num: "04", tag: "Zero human intervention", title: "Autonomous Oracle",
    body: null,
    hasLine: false,
    terminal: `<span class="t-prompt">$ </span><span class="t-cmd">oracle.activateFactor("secp256k1_cve_published")</span>\n<span class="t-prompt">&gt; </span><span class="t-key">score: </span><span class="t-val">90/100</span>  <span class="t-dim">← threshold crossed</span>\n<span class="t-prompt">&gt; </span><span class="t-dim">calling </span><span class="t-val">deprecateECDSA()</span><span class="t-dim"> on 0xA1c3…</span>\n<span class="t-prompt">&gt; </span><span class="t-out">ECDSA permanently disabled. ZK-only mode active.</span>`,
  },
];

export default function Architecture() {
  const sectionRef = useRef<HTMLElement>(null);

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

  return (
    <section id="architecture" className="surface" ref={sectionRef}>
      <div className="container">
        <span className="section-label reveal">How It Works</span>
        <h2 className="section-title reveal">Quantum-safe from spawn to execution.</h2>
        <div className="arch-steps">
          {STEPS.map(step => (
            <div className="arch-step reveal" key={step.num}>
              <div className="arch-step-left">
                <div className="arch-num">{step.num}</div>
                {step.hasLine && <div className="arch-line" />}
              </div>
              <div className="arch-content">
                <span className="tag">{step.tag}</span>
                <h3>{step.title}</h3>
                {step.num === "03" ? (
                  <p>Every agent gets a subdomain under{" "}
                    <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>0xaegis.eth</code>.
                    {" "}Capabilities, pricing, and endpoint are ENS text records. The full ML-DSA public key is served off-chain via CCIP-Read and verified against the on-chain hash.
                  </p>
                ) : step.num === "04" ? (
                  <p>The quantum oracle monitors threat signals — NIST adoption milestones, logical qubit counts, secp256k1 vulnerability disclosures. When the score crosses the threshold, it calls{" "}
                    <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>deprecateECDSA()</code>
                    {" "}on agent accounts autonomously.
                  </p>
                ) : (
                  <p>{step.body}</p>
                )}
                <Terminal html={step.terminal} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
