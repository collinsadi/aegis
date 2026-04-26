import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import Groth16VerifierModule from "./Groth16Verifier";

/**
 * AegisAccountModule
 * Deploys a single AegisAccount for demo purposes.
 * In production, agents deploy their own accounts via the SDK.
 *
 * Parameters:
 *   owner       — Ethereum address that owns this agent account
 *   oracle      — Ethereum address authorized to call deprecateECDSA()
 *   pubKeyHash  — bytes32 keccak256 of the agent's ML-DSA public key
 *
 * Depends on Groth16VerifierModule for the verifier address.
 */
const AegisAccountModule = buildModule("AegisAccountModule", (m) => {
  const { verifier } = m.useModule(Groth16VerifierModule);

  const owner = m.getParameter("owner", "0x0000000000000000000000000000000000000001");
  const oracle = m.getParameter("oracle", "0x0000000000000000000000000000000000000002");
  const pubKeyHash = m.getParameter(
    "pubKeyHash",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );

  const account = m.contract("AegisAccount", [owner, oracle, verifier, pubKeyHash]);
  return { account, verifier };
});

export default AegisAccountModule;
