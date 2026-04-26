import { ethers } from "ethers";

const RESOLVER_ABI = [
  "function getAgentRecord(bytes32 node) view returns (address accountAddress, bytes32 pubKeyHash, bool exists)",
];

function getResolver() {
  const rpcUrl  = process.env.SEPOLIA_RPC_URL;
  const address = process.env.AEGIS_RESOLVER_ADDRESS;

  if (!rpcUrl || !address) {
    throw new Error("SEPOLIA_RPC_URL and AEGIS_RESOLVER_ADDRESS must be set in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(address, RESOLVER_ABI, provider);
}

/**
 * Verify that keccak256(submittedKey) matches the pubKeyHash stored on-chain
 * for the given ENS node.
 *
 * This is the only auth mechanism the gateway needs: if you know the full
 * 1952-byte key that hashes to the on-chain value, you are the legitimate agent.
 * A third party cannot submit a different key because their hash would not match.
 */
export async function verifyKeyAgainstChain(
  node: string,
  keyBuffer: Buffer
): Promise<{ ok: boolean; reason?: string }> {
  let record: { accountAddress: string; pubKeyHash: string; exists: boolean };

  try {
    const resolver = getResolver();
    const [accountAddress, pubKeyHash, exists] = await resolver.getAgentRecord(node);
    record = { accountAddress, pubKeyHash, exists };
  } catch (e: any) {
    return { ok: false, reason: `RPC error: ${e.message}` };
  }

  if (!record.exists) {
    return { ok: false, reason: "Node not registered on-chain. Call AegisENSResolver.registerAgent() first." };
  }

  const submittedHash = ethers.keccak256(keyBuffer);
  if (submittedHash.toLowerCase() !== record.pubKeyHash.toLowerCase()) {
    return { ok: false, reason: "Key does not match on-chain pubKeyHash. Submit the exact key registered on-chain." };
  }

  return { ok: true };
}
