import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import Groth16VerifierModule from "./Groth16Verifier";

/**
 * AegisFactoryModule
 * Deploys AegisFactory, which is the single entry point for deploying
 * new AegisAccount contracts.
 *
 * Depends on Groth16VerifierModule — the verifier address is passed
 * to the factory constructor and baked in permanently.
 *
 * Deployment order:
 *   1. Groth16Verifier  (no dependencies)
 *   2. AegisENSResolver (no dependencies)
 *   3. AegisFactory     (depends on Groth16Verifier)
 *
 * After deployment, copy the factory address into:
 *   config/ens.config.ts → ENS_CONFIG.AEGIS_FACTORY_ADDRESS
 */
const AegisFactoryModule = buildModule("AegisFactoryModule", (m) => {
  const { verifier } = m.useModule(Groth16VerifierModule);
  const factory = m.contract("AegisFactory", [verifier]);
  return { factory, verifier };
});

export default AegisFactoryModule;
