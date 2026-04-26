import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer id="footer">
      <div className="container footer-inner">
        <Link to="/" className="footer-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          Aegis
        </Link>
        <div className="footer-links">
          <a href="https://github.com/collinsadi/aegis" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@0xaegis/sdk" target="_blank" rel="noopener">npm</a>
          <Link to="/docs">Docs</Link>
          <a href="https://sepolia.etherscan.io/address/0x529754f82E4cDFc7063b944D5A1F86138B115a40" target="_blank" rel="noopener">Sepolia Etherscan</a>
        </div>
        <span className="footer-copy">MIT License · ETHGlobal</span>
      </div>
    </footer>
  );
}
