import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import ParticleCanvas from "./ParticleCanvas";
export default function Hero() {
    return (_jsxs("section", { id: "hero", children: [_jsx(ParticleCanvas, {}), _jsxs("div", { className: "hero-content", children: [_jsxs("h1", { className: "hero-title", children: ["Every agent wallet", _jsx("br", {}), "has an expiry date."] }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { href: "#architecture", className: "btn-primary", children: "See the architecture" }), _jsx(Link, { to: "/docs", className: "btn-ghost", children: "Read the docs \u2192" })] })] })] }));
}
