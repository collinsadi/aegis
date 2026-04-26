import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
function Terminal({ html }) {
    return (_jsxs("div", { className: "terminal", children: [_jsxs("div", { className: "terminal-header", children: [_jsx("div", { className: "tdot r" }), _jsx("div", { className: "tdot y" }), _jsx("div", { className: "tdot g" })] }), _jsx("div", { className: "terminal-body", dangerouslySetInnerHTML: { __html: html } })] }));
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
    const sectionRef = useRef(null);
    useEffect(() => {
        const section = sectionRef.current;
        if (!section)
            return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        section.querySelectorAll(".reveal").forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);
    return (_jsx("section", { id: "architecture", className: "surface", ref: sectionRef, children: _jsxs("div", { className: "container", children: [_jsx("span", { className: "section-label reveal", children: "How It Works" }), _jsx("h2", { className: "section-title reveal", children: "Quantum-safe from spawn to execution." }), _jsx("div", { className: "arch-steps", children: STEPS.map(step => (_jsxs("div", { className: "arch-step reveal", children: [_jsxs("div", { className: "arch-step-left", children: [_jsx("div", { className: "arch-num", children: step.num }), step.hasLine && _jsx("div", { className: "arch-line" })] }), _jsxs("div", { className: "arch-content", children: [_jsx("span", { className: "tag", children: step.tag }), _jsx("h3", { children: step.title }), step.num === "03" ? (_jsxs("p", { children: ["Every agent gets a subdomain under", " ", _jsx("code", { style: { fontFamily: "var(--mono)", color: "var(--accent)" }, children: "0xaegis.eth" }), ".", " ", "Capabilities, pricing, and endpoint are ENS text records. The full ML-DSA public key is served off-chain via CCIP-Read and verified against the on-chain hash."] })) : step.num === "04" ? (_jsxs("p", { children: ["The quantum oracle monitors threat signals \u2014 NIST adoption milestones, logical qubit counts, secp256k1 vulnerability disclosures. When the score crosses the threshold, it calls", " ", _jsx("code", { style: { fontFamily: "var(--mono)", color: "var(--accent)" }, children: "deprecateECDSA()" }), " ", "on agent accounts autonomously."] })) : (_jsx("p", { children: step.body })), _jsx(Terminal, { html: step.terminal })] })] }, step.num))) })] }) }));
}
