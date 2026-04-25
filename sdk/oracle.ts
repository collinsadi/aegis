import { ethers } from "ethers";

// ThreatLevel is a number from 0 to 100.
// 0 = no threat detected. 100 = ECDSA must be deprecated immediately.
export type ThreatLevel = number;

// ThreatFactor is a named component of the threat score.
export interface ThreatFactor {
  name: string;       // human-readable name e.g. "nist_pqc_finalized"
  weight: number;     // 0 to 100, how much this factor contributes
  active: boolean;    // whether this factor is currently triggered
}

export class QuantumOracle {
  // DEPRECATION_THRESHOLD is the score at which the oracle will call deprecateECDSA.
  // Set to 70 out of 100.
  static readonly DEPRECATION_THRESHOLD = 70;

  // These are the threat factors the oracle monitors.
  // In a real deployment these would be read from an API or on-chain oracle.
  // For the MVP demo, they are toggled manually.
  private factors: ThreatFactor[] = [
    { name: "nist_pqc_fully_deployed",    weight: 30, active: false },
    { name: "logical_qubits_above_1000",  weight: 25, active: false },
    { name: "secp256k1_cve_published",    weight: 35, active: false },
    { name: "eth_core_dev_warning",       weight: 10, active: false },
  ];

  // getThreatScore sums the weights of all active factors.
  getThreatScore(): ThreatLevel {
    return this.factors
      .filter(f => f.active)
      .reduce((sum, f) => sum + f.weight, 0);
  }

  // activateFactor sets a named factor to active.
  // Throws an error if the factor name does not exist.
  activateFactor(name: string): void {
    const factor = this.factors.find(f => f.name === name);
    if (!factor) throw new Error(`Unknown threat factor: ${name}`);
    factor.active = true;
    console.log(`[Oracle] Factor activated: ${name}. New score: ${this.getThreatScore()}`);
  }

  // shouldDeprecate returns true when the threat score is at or above the threshold.
  shouldDeprecate(): boolean {
    return this.getThreatScore() >= QuantumOracle.DEPRECATION_THRESHOLD;
  }

  // deprecateOnChain calls the deprecateECDSA() function on an AegisAccount contract.
  // contractAddress: the deployed AegisAccount address (0x-prefixed hex string)
  // signer: an ethers.Signer that is authorized to call deprecateECDSA (must be the oracle address)
  // abi: the ABI array for AegisAccount (import it from the Hardhat artifacts)
  async deprecateOnChain(
    contractAddress: string,
    signer: ethers.Signer,
    abi: any[]
  ): Promise<void> {
    if (!this.shouldDeprecate()) {
      console.log("[Oracle] Threat score below threshold. Not deprecating.");
      return;
    }

    const contract = new ethers.Contract(contractAddress, abi, signer);
    const tx = await contract.deprecateECDSA();
    await tx.wait();
    console.log(`[Oracle] deprecateECDSA() called on ${contractAddress}. Tx: ${tx.hash}`);
  }

  // getReport returns a human-readable summary of the current threat state.
  getReport(): string {
    const lines = [
      `=== Quantum Threat Report ===`,
      `Score: ${this.getThreatScore()} / 100`,
      `Threshold: ${QuantumOracle.DEPRECATION_THRESHOLD}`,
      `Should deprecate: ${this.shouldDeprecate()}`,
      ``,
      `Factors:`,
      ...this.factors.map(f =>
        `  [${f.active ? "X" : " "}] ${f.name} (weight: ${f.weight})`
      ),
    ];
    return lines.join("\n");
  }
}
