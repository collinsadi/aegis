/**
 * Aegis ENS Configuration
 * ========================
 * This is the only file you need to edit when changing ENS names,
 * resolver addresses, gateway URLs, or oracle text record keys.
 *
 * All ENS-related values across the entire codebase are imported from here.
 */

export const ENS_CONFIG = {
  /**
   * The parent ENS domain owned by the Aegis protocol.
   * All agent subdomains are registered under this name.
   * Example: alice.0xaegis.eth, bob.0xaegis.eth
   */
  PARENT_DOMAIN: "0xaegis.eth",

  /**
   * The canonical ENS name where the quantum oracle publishes
   * live threat status. Read by any agent, wallet, or dapp
   * that wants to know whether ECDSA is still safe.
   */
  THREAT_FEED_DOMAIN: "threat.0xaegis.eth",

  /**
   * The ENS registry contract address.
   * Mainnet: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
   * Sepolia testnet: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e (same)
   */
  ENS_REGISTRY_ADDRESS: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",

  /**
   * The ENS public resolver address.
   * Used to read and write text records (capabilities, threat feed, etc.)
   * Sepolia: 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD
   */
  PUBLIC_RESOLVER_ADDRESS: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",

  /**
   * The deployed AegisENSResolver contract address.
   * Set this after running the Ignition deployment.
   * This is the CCIP-Read resolver for *.0xaegis.eth subdomains.
   */
  AEGIS_RESOLVER_ADDRESS: "0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c" as string, // Fill after deployment
  /**
   * The deployed AegisFactory contract address.
   * Set this after running the Ignition deployment for AegisFactoryModule.
   * This is the address the SDK calls to deploy new AegisAccount contracts.
   */
  AEGIS_FACTORY_ADDRESS: "0x529754f82E4cDFc7063b944D5A1F86138B115a40" as string, // Fill after deployment

  /**
   * The CCIP-Read gateway URL.
   * This is the off-chain server that serves full ML-DSA public keys
   * when the on-chain resolver redirects to it.
   * For local dev use the mock gateway. For production deploy the gateway server.
   */
  CCIP_GATEWAY_URL: "https://gateway.0xaegis.eth",
  CCIP_GATEWAY_URL_LOCAL: "http://localhost:8080",

  /**
   * ENS text record keys used by Aegis agents.
   * These are the keys written to each agent's subdomain.
   */
  TEXT_RECORD_KEYS: {
    /** Comma-separated list of things this agent can do */
    CAPABILITIES: "capabilities",
    /** HTTPS endpoint where this agent accepts operation requests */
    ENDPOINT: "endpoint",
    /** ETH cost per operation, as a decimal string */
    PRICE: "price",
    /** AI model powering this agent */
    MODEL: "model",
    /** Uptime percentage as a string e.g. "99.2" */
    UPTIME: "uptime",
    /** ISO 8601 timestamp of last key rotation */
    KEY_ROTATED_AT: "keyRotatedAt",
    /** The PQ key scheme in use e.g. "ml-dsa-65" */
    KEY_SCHEME: "keyScheme",
  },

  /**
   * ENS text record keys written to threat.0xaegis.eth by the oracle.
   */
  THREAT_RECORD_KEYS: {
    /** Numeric threat score 0–100 as a string */
    SCORE: "score",
    /** "true" or "false" — whether ECDSA is still considered safe */
    ECDSA_SAFE: "ecdsaSafe",
    /** Unix timestamp when the oracle last updated */
    LAST_UPDATED: "lastUpdated",
    /** Comma-separated names of active threat factors */
    TRIGGERED_BY: "triggeredBy",
    /** Human-readable recommended action string */
    RECOMMENDED_ACTION: "recommendedAction",
  },
} as const;
