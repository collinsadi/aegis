import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
export default function Navbar() {
    const navRef = useRef(null);
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const isDocsPage = location.pathname === "/docs";
    useEffect(() => {
        if (isDocsPage)
            return;
        const handler = () => {
            navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
        };
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, [isDocsPage]);
    const close = () => setOpen(false);
    return (_jsxs("nav", { id: "navbar", ref: navRef, className: isDocsPage ? "scrolled" : "", children: [_jsxs("div", { className: "nav-inner", children: [_jsxs(Link, { to: "/", className: "nav-logo", children: [_jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", children: _jsx("path", { d: "M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }), "Aegis"] }), _jsxs("div", { className: "nav-links", children: [_jsx(Link, { to: "/", children: "Home" }), !isDocsPage && _jsx("a", { href: "#architecture", children: "Architecture" }), !isDocsPage && _jsx("a", { href: "#ens", children: "ENS" }), !isDocsPage && _jsx("a", { href: "#sdk", children: "SDK" }), _jsx(Link, { to: "/docs", children: "Docs" }), _jsx("a", { href: "https://github.com/collinsadi/aegis", target: "_blank", rel: "noopener", className: "nav-cta", children: "GitHub \u2192" })] }), _jsxs("button", { className: `hamburger${open ? " open" : ""}`, "aria-label": "Menu", "aria-expanded": open, onClick: () => setOpen(v => !v), children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })] }), _jsxs("div", { className: `nav-drawer${open ? " open" : ""}`, children: [_jsx(Link, { to: "/", onClick: close, children: "Home" }), !isDocsPage && _jsx("a", { href: "#architecture", onClick: close, children: "Architecture" }), !isDocsPage && _jsx("a", { href: "#ens", onClick: close, children: "ENS" }), !isDocsPage && _jsx("a", { href: "#sdk", onClick: close, children: "SDK" }), _jsx(Link, { to: "/docs", onClick: close, children: "Docs" }), _jsx("a", { href: "https://github.com/collinsadi/aegis", target: "_blank", rel: "noopener", onClick: close, children: "GitHub \u2192" })] })] }));
}
