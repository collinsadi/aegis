import React from "react";
import Hero from "../components/Hero";
import Marquee from "../components/Marquee";
import Problem from "../components/Problem";
import Architecture from "../components/Architecture";
import EnsSection from "../components/EnsSection";
import ZeroGSection from "../components/ZeroGSection";
import SdkSection from "../components/SdkSection";
import Metrics from "../components/Metrics";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <main id="main-content">
      <Hero />
      <Marquee />
      <Problem />
      <Architecture />
      <EnsSection />
      <ZeroGSection />
      <SdkSection />
      <Metrics />
      <Footer />
    </main>
  );
}
