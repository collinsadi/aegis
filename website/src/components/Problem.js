import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
export default function Problem() {
    const sectionRef = useRef(null);
    useEffect(() => {
        const section = sectionRef.current;
        if (!section)
            return;
        const els = section.querySelectorAll(".reveal");
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        els.forEach((el, i) => {
            if (el.closest(".problem-grid")) {
                el.style.transitionDelay = `calc(${[...el.parentElement.children].indexOf(el)} * 80ms)`;
            }
            observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);
    return (_jsx("section", { id: "problem", ref: sectionRef, children: _jsxs("div", { className: "container", children: [_jsx("span", { className: "section-label reveal", children: "The Problem" }), _jsxs("h2", { className: "section-title reveal", children: ["Every AI agent wallet is a liability", _jsx("br", {}), "waiting to happen."] }), _jsxs("div", { className: "problem-grid", children: [_jsxs("div", { className: "card problem-card reveal", children: [_jsx("div", { className: "problem-card-icon", children: _jsx("i", { "data-lucide": "shield-off", className: "icon-20" }) }), _jsx("h3", { children: "ECDSA is quantum-vulnerable" }), _jsx("p", { children: "Shor's algorithm breaks secp256k1 in hours on a fault-tolerant quantum computer. Every agent running today \u2014 regardless of framework \u2014 signs with a key that has a known expiry date." })] }), _jsxs("div", { className: "card problem-card reveal", children: [_jsx("div", { className: "problem-card-icon", children: _jsx("i", { "data-lucide": "bot", className: "icon-20" }) }), _jsx("h3", { children: "Agents can't self-rescue" }), _jsx("p", { children: "A human detects a threat and rotates their wallet. An autonomous agent cannot detect the threat, evaluate the risk, or pause its own operations. The window from breach to drain is seconds." })] }), _jsxs("div", { className: "card problem-card reveal", children: [_jsx("div", { className: "problem-card-icon", children: _jsx("i", { "data-lucide": "database", className: "icon-20" }) }), _jsx("h3", { children: "Harvest now, decrypt later" }), _jsx("p", { children: "Adversaries record ECDSA-signed transactions today. When quantum hardware matures, every historical signature is retroactively compromised. Keys deployed in 2024 may be broken by 2029." })] })] })] }) }));
}
