import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
const CARDS = [
    {
        icon: "key-round",
        title: "PQ Public Key Infrastructure",
        body: "Every agent's ML-DSA public key is anchored to its ENS subdomain via CCIP-Read. On-chain: 32 bytes. Off-chain: 1952 bytes, hash-verified on every resolution.",
        snippet: `<span class="es-fn">resolve</span>(<span class="es-str">"alice.0xaegis.eth"</span>)\n<span class="es-out">→ address:    </span><span class="es-val">0xA1c3…</span>\n<span class="es-out">→ pubKeyHash: </span><span class="es-val">0x7f3a…</span>  <span class="es-out">← on-chain</span>\n<span class="es-out">→ pubKey:     </span><span class="es-val">1952 bytes</span>  <span class="es-out">← CCIP-Read</span>`,
    },
    {
        icon: "radio",
        title: "Global Threat Feed",
        bodyJsx: true,
        snippet: `<span class="es-fn">text</span>(<span class="es-str">"threat.0xaegis.eth"</span>, <span class="es-str">"score"</span>)\n<span class="es-out">→ </span><span class="es-val">"90"</span>\n<span class="es-fn">text</span>(<span class="es-str">"threat.0xaegis.eth"</span>, <span class="es-str">"ecdsaSafe"</span>)\n<span class="es-out">→ </span><span class="es-val">"false"</span>`,
    },
    {
        icon: "search",
        title: "Agent Discovery",
        body: "Agents publish capabilities, pricing, and endpoints as text records. Any agent discovers counterparts via ENS subgraph queries — no registry contract, no API key.",
        snippet: `<span class="es-fn">text</span>(<span class="es-str">"alice.0xaegis.eth"</span>, <span class="es-str">"capabilities"</span>)\n<span class="es-out">→ </span><span class="es-val">"trade,escrow,price-feed"</span>\n<span class="es-fn">text</span>(<span class="es-str">"alice.0xaegis.eth"</span>, <span class="es-str">"endpoint"</span>)\n<span class="es-out">→ </span><span class="es-val">"https://alice.yourapp.com/rpc"</span>`,
    },
    {
        icon: "shield-check",
        title: "Post-Quantum Handshake",
        body: "Agent-to-agent identity is established via ML-DSA challenge-response anchored to ENS names. No ECDSA. No TLS. No certificate authority.",
        snippet: `<span class="es-fn">initiateHandshake</span>(<span class="es-str">"alice"</span>) <span class="es-out">→ nonce</span>\n<span class="es-fn">alice.sign</span>(nonce) <span class="es-out">→ ml-dsa signature</span>\n<span class="es-fn">verifyHandshake</span>(nonce, sig, pubKey)\n<span class="es-out">→ </span><span class="es-val">true</span>  <span class="es-out">← identity confirmed</span>`,
    },
];
export default function EnsSection() {
    const sectionRef = useRef(null);
    useEffect(() => {
        const section = sectionRef.current;
        if (!section)
            return;
        const grid = section.querySelector(".ens-grid");
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        section.querySelectorAll(".reveal").forEach((el, i) => {
            if (el.closest(".ens-grid")) {
                el.style.transitionDelay = `calc(${[...el.parentElement.children].indexOf(el)} * 80ms)`;
            }
            observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);
    return (_jsx("section", { id: "ens", ref: sectionRef, children: _jsxs("div", { className: "container", children: [_jsx("span", { className: "section-label reveal", children: "ENS Integration" }), _jsxs("h2", { className: "section-title reveal", children: ["ENS is not a feature.", _jsx("br", {}), "It's the protocol's backbone."] }), _jsx("p", { className: "section-sub reveal", children: "The entire Aegis trust model \u2014 identity, discovery, public key infrastructure, and threat broadcasting \u2014 runs on ENS." }), _jsx("div", { className: "ens-grid", children: CARDS.map((card, i) => (_jsxs("div", { className: "card ens-card reveal", children: [_jsx("div", { className: "ens-icon", children: _jsx("i", { "data-lucide": card.icon, className: "icon" }) }), _jsx("h3", { children: card.title }), card.bodyJsx ? (_jsxs("p", { children: ["The oracle writes live quantum threat status to", " ", _jsx("code", { style: { fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent)" }, children: "threat.0xaegis.eth" }), " ", "as ENS text records. One write propagates to every consumer instantly."] })) : (_jsx("p", { children: card.body })), _jsx("div", { className: "ens-snippet", dangerouslySetInnerHTML: { __html: card.snippet } })] }, i))) })] }) }));
}
