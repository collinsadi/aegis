import React from "react";
import { Link } from "react-router-dom";
import ParticleCanvas from "./ParticleCanvas";

export default function Hero() {
  return (
    <section id="hero">
      <ParticleCanvas />
      <div className="hero-content">
        <h1 className="hero-title">
          Every agent wallet<br />
          has an expiry date.
        </h1>
        <div className="hero-actions">
          <a href="#architecture" className="btn-primary">See the architecture</a>
          <Link to="/docs" className="btn-ghost">Read the docs →</Link>
        </div>
      </div>
    </section>
  );
}
