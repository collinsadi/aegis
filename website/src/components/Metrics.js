import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
const METRICS = [
    { count: 2.3, suffix: "M+", decimals: 1, label: "agent wallets on ECDSA today" },
    { count: 50, prefix: "$", suffix: "B+", label: "agent-held TVL by 2027" },
    { count: 76, suffix: "%", label: "gas reduction vs raw PQ sigs" },
    { count: 200, suffix: "k", label: "gas per ZK proof verification" },
    { count: 0, label: "humans required for key rotation" },
    { count: 3, label: "lines of code to integrate" },
];
export default function Metrics() {
    const sectionRef = useRef(null);
    useEffect(() => {
        const section = sectionRef.current;
        if (!section)
            return;
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
        const duration = 1200;
        const animated = new Set();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting || animated.has(entry.target))
                    return;
                animated.add(entry.target);
                const el = entry.target;
                const target = parseFloat(el.dataset.count ?? "0");
                const prefix = el.dataset.prefix ?? "";
                const suffix = el.dataset.suffix ?? "";
                const decimals = parseInt(el.dataset.decimals ?? "0");
                const start = performance.now();
                function frame(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const value = easeOutQuart(progress) * target;
                    el.textContent = prefix + value.toFixed(decimals) + suffix;
                    if (progress < 1)
                        requestAnimationFrame(frame);
                }
                requestAnimationFrame(frame);
            });
        }, { threshold: 0.3 });
        section.querySelectorAll(".metric-num").forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);
    return (_jsx("section", { id: "metrics", ref: sectionRef, children: _jsx("div", { className: "container", children: _jsx("div", { className: "metrics-row", children: METRICS.map((m, i) => (_jsxs("div", { className: "metric-item", children: [_jsx("div", { className: "metric-num", "data-count": m.count, "data-suffix": m.suffix, "data-prefix": m.prefix, "data-decimals": m.decimals, children: "0" }), _jsx("div", { className: "metric-label", children: m.label })] }, i))) }) }) }));
}
