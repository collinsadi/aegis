import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * AegisENSResolverModule
 * Deploys the CCIP-Read ENS resolver for *.0xaegis.eth subdomains.
 *
 * Parameter: gatewayUrl — the CCIP-Read gateway URL.
 * For local dev this is "http://localhost:8080/{sender}/{data}.json"
 * For production this is "https://gateway.0xaegis.eth/{sender}/{data}.json"
 *
 * After deployment, copy the deployed address into:
 *   config/ens.config.ts → ENS_CONFIG.AEGIS_RESOLVER_ADDRESS
 */
const AegisENSResolverModule = buildModule("AegisENSResolverModule", (m) => {
  const gatewayUrl = m.getParameter(
    "gatewayUrl",
    "http://localhost:8080/{sender}/{data}.json"
  );

  const resolver = m.contract("AegisENSResolver", [gatewayUrl]);
  return { resolver };
});

export default AegisENSResolverModule;
