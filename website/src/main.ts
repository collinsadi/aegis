import "./style.css";
import * as THREE from "three";

// ── Three.js animated background ─────────────────────────────────────────────

function initBackground() {
  const canvas  = document.getElementById("bg-canvas") as HTMLCanvasElement;
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // Particle field
  const count     = 800;
  const geometry  = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    const t = Math.random();
    if (t < 0.5) {
      colors[i * 3] = 0.61; colors[i * 3 + 1] = 0.36; colors[i * 3 + 2] = 0.9; // purple
    } else {
      colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.79; colors[i * 3 + 2] = 0.94; // cyan
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size:            0.035,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.55,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Mouse parallax
  let mouseX = 0, mouseY = 0;
  window.addEventListener("mousemove", e => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.5;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
  });

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function animate() {
    requestAnimationFrame(animate);
    particles.rotation.y += 0.0008;
    particles.rotation.x += 0.0003;
    camera.position.x += (mouseX - camera.position.x) * 0.03;
    camera.position.y += (-mouseY - camera.position.y) * 0.03;
    renderer.render(scene, camera);
  }
  animate();
}

// ── Navbar scroll effect ──────────────────────────────────────────────────────

function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });
}

// ── Intersection observer for fade-in ────────────────────────────────────────

function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).style.opacity   = "1";
        (entry.target as HTMLElement).style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(".glass-card, .step, .metric-card").forEach(el => {
    (el as HTMLElement).style.opacity    = "0";
    (el as HTMLElement).style.transform  = "translateY(24px)";
    (el as HTMLElement).style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(el);
  });
}

// ── Docs page router ──────────────────────────────────────────────────────────

function handleRouting() {
  const path = window.location.pathname;
  if (path === "/docs" || path === "/docs/") {
    renderDocs();
  }
}

function renderDocs() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <nav id="navbar" class="scrolled" style="position:relative;">
      <div class="nav-inner">
        <a href="/" class="nav-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span>Aegis</span>
        </a>
        <div class="nav-links">
          <a href="/">Home</a>
          <a href="https://github.com/0xadi/aegis" target="_blank">GitHub</a>
        </div>
      </div>
    </nav>
    <main style="max-width:800px;margin:0 auto;padding:120px 24px 80px;">
      <div class="section-label" style="margin-bottom:12px">Documentation</div>
      <h1 style="font-size:clamp(28px,4vw,48px);font-weight:700;letter-spacing:-.02em;margin-bottom:48px;line-height:1.1">
        Migrate your AI agent<br/>to Aegis in 15 minutes.
      </h1>

      <div class="docs-section">
        <h2>Prerequisites</h2>
        <ul>
          <li>Node.js 20+</li>
          <li>An Ethereum wallet with Sepolia ETH</li>
          <li>A deployed AI agent that currently uses an ECDSA wallet</li>
        </ul>
      </div>

      <div class="docs-section">
        <h2>Step 1 — Install the SDK</h2>
        <pre class="doc-code mono">npm install @0xaegis/sdk ethers</pre>
      </div>

      <div class="docs-section">
        <h2>Step 2 — Generate a PQ wallet for your agent</h2>
        <pre class="doc-code mono">import { AegisWallet } from "@0xaegis/sdk";

// Each agent gets a unique ML-DSA-65 keypair
const wallet = new AegisWallet("my-agent-name");

// The public key hash is what goes on-chain
console.log(wallet.publicKeyHash()); // 32-byte keccak256</pre>
      </div>

      <div class="docs-section">
        <h2>Step 3 — Deploy an AegisAccount via the factory</h2>
        <pre class="doc-code mono">import { AegisENS } from "@0xaegis/sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
const ens      = new AegisENS(provider, signer);
await ens.init();

// Deploys AegisAccount + registers alice.0xaegis.eth in one call
const result = await ens.deployAgent(
  "alice",
  signer.address,
  signer.address,        // oracle address
  wallet.publicKeyHash(),
  {
    capabilities: "trade,escrow",
    endpoint:     "https://alice.yourapp.com/rpc",
    price:        "0.001",
    model:        "your-model",
    uptime:       "99.5",
  }
);

console.log("Account:", result.accountAddress);
console.log("ENS:    ", result.ensName); // alice.0xaegis.eth</pre>
      </div>

      <div class="docs-section">
        <h2>Step 4 — Sign and execute operations</h2>
        <pre class="doc-code mono">import { AegisProver } from "@0xaegis/sdk";

const prover  = await AegisProver.create();
const message = ethers.toUtf8Bytes("transfer:0xABC:1000000000000000000:nonce:0");

// Sign with ML-DSA-65 (off-chain — signature never goes on-chain)
const signed  = wallet.sign(message);

// Generate a Groth16 ZK proof that compresses the signature
const proof   = await prover.prove(signed.signature, message, wallet.publicKeyHash());
const fmt     = AegisProver.formatProofForSolidity(proof.proof, proof.publicSignals);

// Execute on-chain — only the 256-byte proof hits the network
await account.executeWithZKProof(fmt.pA, fmt.pB, fmt.pC, proof.commitment, target, value, data);</pre>
      </div>

      <div class="docs-section">
        <h2>Step 5 — Register with the CCIP-Read gateway</h2>
        <pre class="doc-code mono"># Start the gateway server
cd server && npm run dev

# Register your agent's full public key
curl -X POST http://localhost:8080/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "node":         "0x&lt;namehash of alice.0xaegis.eth&gt;",
    "publicKeyHex": "0x&lt;1952-byte ML-DSA public key&gt;",
    "agentLabel":   "alice"
  }'</pre>
      </div>

      <div class="docs-section">
        <h2>Contracts (Sepolia)</h2>
        <table class="doc-table">
          <thead><tr><th>Contract</th><th>Address</th></tr></thead>
          <tbody>
            <tr><td>Groth16Verifier</td><td class="mono" style="font-size:13px">0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6</td></tr>
            <tr><td>AegisENSResolver</td><td class="mono" style="font-size:13px">0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c</td></tr>
            <tr><td>AegisFactory</td><td class="mono" style="font-size:13px">0x529754f82E4cDFc7063b944D5A1F86138B115a40</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  `;

  // inject doc styles
  const style = document.createElement("style");
  style.textContent = `
    .docs-section { margin-bottom: 56px; }
    .docs-section h2 { font-size:22px; font-weight:600; margin-bottom:16px; }
    .docs-section ul { padding-left:20px; color:rgba(240,240,248,0.65); line-height:2; }
    .doc-code {
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
      border-radius:12px; padding:20px 24px; font-size:13px; line-height:1.8;
      overflow-x:auto; white-space:pre; color:#c9d1d9; margin-top:0;
    }
    .doc-table { width:100%; border-collapse:collapse; font-size:14px; }
    .doc-table th, .doc-table td { padding:12px 16px; border:1px solid rgba(255,255,255,0.08); text-align:left; }
    .doc-table th { color:rgba(240,240,248,0.5); font-weight:500; background:rgba(255,255,255,0.02); }
  `;
  document.head.appendChild(style);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  handleRouting();
  initNavbar();
  initBackground();
  initAnimations();
});
