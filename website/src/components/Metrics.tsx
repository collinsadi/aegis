import React, { useEffect, useRef } from "react";

const METRICS = [
  { count: 2.3, suffix: "M+", decimals: 1, label: "agent wallets on ECDSA today" },
  { count: 50,  prefix: "$", suffix: "B+", label: "agent-held TVL by 2027" },
  { count: 76,  suffix: "%", label: "gas reduction vs raw PQ sigs" },
  { count: 200, suffix: "k", label: "gas per ZK proof verification" },
  { count: 0,   label: "humans required for key rotation" },
  { count: 3,   label: "lines of code to integrate" },
];

export default function Metrics() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    const duration = 1200;
    const animated = new Set<Element>();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || animated.has(entry.target)) return;
        animated.add(entry.target);
        const el      = entry.target as HTMLElement;
        const target  = parseFloat(el.dataset.count ?? "0");
        const prefix  = el.dataset.prefix ?? "";
        const suffix  = el.dataset.suffix ?? "";
        const decimals = parseInt(el.dataset.decimals ?? "0");
        const start = performance.now();

        function frame(now: number) {
          const elapsed  = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const value    = easeOutQuart(progress) * target;
          el.textContent = prefix + value.toFixed(decimals) + suffix;
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.3 });

    section.querySelectorAll(".metric-num").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="metrics" ref={sectionRef}>
      <div className="container">
        <div className="metrics-row">
          {METRICS.map((m, i) => (
            <div className="metric-item" key={i}>
              <div
                className="metric-num"
                data-count={m.count}
                data-suffix={m.suffix}
                data-prefix={m.prefix}
                data-decimals={m.decimals}
              >
                0
              </div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
