import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isDocsPage = location.pathname === "/docs";

  useEffect(() => {
    if (isDocsPage) return;
    const handler = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [isDocsPage]);

  const close = () => setOpen(false);

  return (
    <nav id="navbar" ref={navRef} className={isDocsPage ? "scrolled" : ""}>
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          Aegis
        </Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          {!isDocsPage && <a href="#architecture">Architecture</a>}
          {!isDocsPage && <a href="#ens">ENS</a>}
          {!isDocsPage && <a href="#sdk">SDK</a>}
          <Link to="/docs">Docs</Link>
          <a href="https://github.com/collinsadi/aegis" target="_blank" rel="noopener" className="nav-cta">GitHub →</a>
        </div>
        <button
          className={`hamburger${open ? " open" : ""}`}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
      <div className={`nav-drawer${open ? " open" : ""}`}>
        <Link to="/" onClick={close}>Home</Link>
        {!isDocsPage && <a href="#architecture" onClick={close}>Architecture</a>}
        {!isDocsPage && <a href="#ens" onClick={close}>ENS</a>}
        {!isDocsPage && <a href="#sdk" onClick={close}>SDK</a>}
        <Link to="/docs" onClick={close}>Docs</Link>
        <a href="https://github.com/collinsadi/aegis" target="_blank" rel="noopener" onClick={close}>GitHub →</a>
      </div>
    </nav>
  );
}
