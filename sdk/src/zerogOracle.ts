/**
 * zerogOracle.ts
 * ==============
 * Extends QuantumOracle with 0G Compute-powered AI threat scoring.
 *
 * When INTEGRATIONS.ZERO_G.ENABLED === true:
 *   - Sends active threat factor names to a 0G Compute LLM (OpenAI-compatible)
 *   - The LLM reasons quantum threat level and returns a score 0-100
 *   - 0G Compute uses TEE (Trusted Execution Environment) — inference is verifiable
 *
 * When disabled: falls back to parent QuantumOracle hardcoded factor weights.
 *
 * Usage:
 *   import { ZeroGQuantumOracle } from "@0xaegis/sdk"
 *   const oracle = new ZeroGQuantumOracle()
 *   oracle.activateFactor("secp256k1_cve_published")
 *   const score = await oracle.computeThreatScore()  // uses 0G if enabled
 */

import { QuantumOracle } from "./oracle";
import { INTEGRATIONS } from "../../config/ens.config";

export class ZeroGQuantumOracle extends QuantumOracle {

  /**
   * Compute threat score.
   * If 0G is enabled: sends active factors to 0G Compute LLM for reasoning.
   * If 0G is disabled: returns parent class hardcoded weighted sum.
   */
  async computeThreatScore(): Promise<number> {
    if (!INTEGRATIONS.ZERO_G.ENABLED) {
      return this.getThreatScore();
    }

    if (!INTEGRATIONS.ZERO_G.COMPUTE_ENDPOINT) {
      console.warn("[0G Oracle] COMPUTE_ENDPOINT not set. Falling back to hardcoded scoring.");
      return this.getThreatScore();
    }

    // Get names of currently active factors for the LLM prompt
    const report      = this.getReport();
    const activeLines = report
      .split("\n")
      .filter(l => l.includes("[X]"))
      .map(l => l.replace(/\[X\]\s*/, "").replace(/\s*\(weight:\s*\d+\)/, "").trim());

    if (activeLines.length === 0) return 0;

    const prompt = `You are a quantum cryptography threat analyst evaluating risks to ECDSA-based
Ethereum wallets. The following threat signals are currently active:

${activeLines.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Score the aggregate threat level from 0 to 100 where:
- 0-30: Low risk, no action needed
- 31-60: Moderate risk, monitor closely
- 61-89: High risk, begin migration planning
- 90-100: Critical, immediate deprecation required

Respond with ONLY a valid JSON object in this exact format with no other text:
{"score": <integer 0-100>, "reasoning": "<one sentence explanation>"}`;

    try {
      const response = await fetch(`${INTEGRATIONS.ZERO_G.COMPUTE_ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:       INTEGRATIONS.ZERO_G.COMPUTE_MODEL,
          max_tokens:  200,
          temperature: 0.1,
          messages: [
            { role: "system", content: "You are a cryptographic security analyst. Respond only with valid JSON." },
            { role: "user",   content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        console.warn(`[0G Oracle] Compute API returned ${response.status}. Falling back to hardcoded scoring.`);
        return this.getThreatScore();
      }

      const data    = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";

      // Strip any markdown fences if present
      const clean   = content.replace(/```json|```/g, "").trim();
      const parsed  = JSON.parse(clean);

      const score   = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      console.log(`[0G Oracle] 0G Compute score: ${score}/100 — ${parsed.reasoning}`);
      return score;

    } catch (e: any) {
      console.warn(`[0G Oracle] Compute call failed: ${e.message}. Falling back to hardcoded scoring.`);
      return this.getThreatScore();
    }
  }

  /**
   * shouldDeprecateAsync — uses computeThreatScore() so it respects 0G when enabled.
   * Always safe to call — falls back to sync parent method if 0G is off.
   */
  async shouldDeprecateAsync(): Promise<boolean> {
    const score = await this.computeThreatScore();
    return score >= QuantumOracle.DEPRECATION_THRESHOLD;
  }
}
