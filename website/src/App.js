import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Lenis from "lenis";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Docs from "./pages/Docs";
export default function App() {
    useEffect(() => {
        const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
        function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
        return () => lenis.destroy();
    }, []);
    useEffect(() => {
        if (window.lucide)
            window.lucide.createIcons();
    });
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/docs", element: _jsx(Docs, {}) })] })] }));
}
