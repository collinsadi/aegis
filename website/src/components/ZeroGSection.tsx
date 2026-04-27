import React, { useEffect, useRef } from "react";

const FEATURES = [
  {
    icon: "database",
    tag: "0G Storage",
    title: "ML-DSA Keys on Decentralised Storage",
    body: "Each agent's 1952-byte ML-DSA public key is uploaded to the 0G network, content-addressed by its Merkle root. Keys survive gateway restarts, require no managed database, and can be fetched by any node that holds the file.",
    snippet: `<span class="zg-fn">indexer</span>.<span class="zg-fn">upload</span>(keyBytes, rpc, signer)\n<span class="zg-out">→ rootHash: </span><span class="zg-val">0x9d627e…</span>  <span class="zg-dim">← content address</span>\n<span class="zg-out">→ txHash:   </span><span class="zg-val">0xac1fd0…</span>  <span class="zg-dim">← 0G chain tx</span>\n<span class="zg-out">→ txSeq:    </span><span class="zg-val">51570</span>       <span class="zg-dim">← flow index</span>`,
  },
  {
    icon: "cpu",
    tag: "0G Compute",
    title: "Verifiable AI Threat Scoring",
    body: "The quantum threat oracle sends active threat signals to an LLM running inside a 0G Compute TEE. The model reasons a score 0–100 with an explanation. TEE execution means the inference is verifiable without exposing model weights.",
    snippet: `<span class="zg-fn">computeThreatScore</span>() <span class="zg-dim">// 0G Compute</span>\n<span class="zg-out">→ model:  </span><span class="zg-val">qwen3.6-plus</span>  <span class="zg-dim">(in TEE)</span>\n<span class="zg-out">→ score:  </span><span class="zg-val">90</span> <span class="zg-dim">/ 100</span>\n<span class="zg-out">→ reason: </span><span class="zg-val">"CVE + qubit milestone active"</span>`,
  },
];

export default function ZeroGSection() {
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
    <section id="zerog" className="surface" ref={sectionRef}>
      <div className="container">
        <span className="section-label reveal">0G Integration</span>
        <h2 className="section-title reveal">
          Decentralised storage.<br />Verifiable AI inference.
        </h2>
        <p className="section-sub reveal">
          Aegis uses 0G for two things ECDSA infrastructure never needed and post-quantum infrastructure always will —
          persistent key storage across a decentralised network, and AI-powered threat scoring whose execution is provable.
        </p>

        <div className="zg-grid reveal">
          {FEATURES.map((f, i) => (
            <div className="card zg-card" key={i}>
              <div className="zg-card-head">
                <div className="zg-icon">
                  <i data-lucide={f.icon} className="icon" />
                </div>
                <span className="tag">{f.tag}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <div className="zg-snippet" dangerouslySetInnerHTML={{ __html: f.snippet }} />
            </div>
          ))}
        </div>

       
      </div>
    </section>
  );
}
