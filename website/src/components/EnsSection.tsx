import React, { useEffect, useRef } from "react";

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
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const grid = section.querySelector(".ens-grid");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    section.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
      if (el.closest(".ens-grid")) {
        el.style.transitionDelay = `calc(${[...el.parentElement!.children].indexOf(el)} * 80ms)`;
      }
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <section id="ens" ref={sectionRef}>
      <div className="container">
        <span className="section-label reveal">ENS Integration</span>
        <h2 className="section-title reveal">ENS is not a feature.<br />It's the protocol's backbone.</h2>
        <p className="section-sub reveal">The entire Aegis trust model — identity, discovery, public key infrastructure, and threat broadcasting — runs on ENS.</p>
        <div className="ens-grid">
          {CARDS.map((card, i) => (
            <div className="card ens-card reveal" key={i}>
              <div className="ens-icon"><i data-lucide={card.icon} className="icon" /></div>
              <h3>{card.title}</h3>
              {card.bodyJsx ? (
                <p>The oracle writes live quantum threat status to{" "}
                  <code style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent)" }}>threat.0xaegis.eth</code>
                  {" "}as ENS text records. One write propagates to every consumer instantly.
                </p>
              ) : (
                <p>{card.body}</p>
              )}
              <div className="ens-snippet" dangerouslySetInnerHTML={{ __html: card.snippet }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
