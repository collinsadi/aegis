import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
const ITEMS = [
    "ML-DSA-65", "Groth16", "BN254", "NIST FIPS 204", "EIP-3668",
    "ENS", "ERC-4337", "Sepolia", "CCIP-Read", "Poseidon Hash", "CREATE2",
];
export default function Marquee() {
    const all = [...ITEMS, ...ITEMS];
    return (_jsx("div", { id: "marquee", children: _jsx("div", { className: "marquee-track", children: all.map((item, i) => (_jsxs(React.Fragment, { children: [_jsx("span", { className: "marquee-item", children: item }), _jsx("span", { className: "marquee-sep", children: "\u00B7" })] }, i))) }) }));
}
