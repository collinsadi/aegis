import React, { useEffect, useRef } from "react";

export default function Problem() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const els = section.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach((el, i) => {
      if (el.closest(".problem-grid")) {
        el.style.transitionDelay = `calc(${[...el.parentElement!.children].indexOf(el)} * 80ms)`;
      }
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <section id="problem" ref={sectionRef}>
      <div className="container">
        <span className="section-label reveal">The Problem</span>
        <h2 className="section-title reveal">Every AI agent wallet is a liability<br />waiting to happen.</h2>
        <div className="problem-grid">
          <div className="card problem-card reveal">
            <div className="problem-card-icon"><i data-lucide="shield-off" className="icon-20" /></div>
            <h3>ECDSA is quantum-vulnerable</h3>
            <p>Shor's algorithm breaks secp256k1 in hours on a fault-tolerant quantum computer. Every agent running today — regardless of framework — signs with a key that has a known expiry date.</p>
          </div>
          <div className="card problem-card reveal">
            <div className="problem-card-icon"><i data-lucide="bot" className="icon-20" /></div>
            <h3>Agents can't self-rescue</h3>
            <p>A human detects a threat and rotates their wallet. An autonomous agent cannot detect the threat, evaluate the risk, or pause its own operations. The window from breach to drain is seconds.</p>
          </div>
          <div className="card problem-card reveal">
            <div className="problem-card-icon"><i data-lucide="database" className="icon-20" /></div>
            <h3>Harvest now, decrypt later</h3>
            <p>Adversaries record ECDSA-signed transactions today. When quantum hardware matures, every historical signature is retroactively compromised. Keys deployed in 2024 may be broken by 2029.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
