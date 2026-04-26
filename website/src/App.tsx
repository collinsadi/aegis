import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Lenis from "lenis";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Docs from "./pages/Docs";

declare global {
  interface Window { lucide: any; }
}

export default function App() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"     element={<Home />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </>
  );
}
