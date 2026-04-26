import React from "react";

const ITEMS = [
  "ML-DSA-65", "Groth16", "BN254", "NIST FIPS 204", "EIP-3668",
  "ENS", "ERC-4337", "Sepolia", "CCIP-Read", "Poseidon Hash", "CREATE2",
];

export default function Marquee() {
  const all = [...ITEMS, ...ITEMS];
  return (
    <div id="marquee">
      <div className="marquee-track">
        {all.map((item, i) => (
          <React.Fragment key={i}>
            <span className="marquee-item">{item}</span>
            <span className="marquee-sep">·</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
