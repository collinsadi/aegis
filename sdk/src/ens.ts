import { ethers } from "ethers";
import { ENS_CONFIG } from "../../config/ens.config";
import AegisENSResolverAbi from "../abis/AegisENSResolver.json";
import AegisFactoryAbi from "../abis/AegisFactory.json";

/**
 * AegisENS
 * =========
 * The ENS integration layer for Aegis.
 *
 * Handles:
 *   - Registering agent subdomains under 0xaegis.eth
 *   - Resolving agent names to AegisAccount addresses and pubKeyHashes
 *   - CCIP-Read triggered public key fetches (full 1952-byte ML-DSA key)
 *   - Oracle publishing threat status to threat.0xaegis.eth
 *   - Agent capability publishing and discovery
 *   - Post-quantum agent-to-agent handshake using ENS as the trust anchor
 */
export class AegisENS {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null;
  private resolverContract: ethers.Contract | null;
  private factoryContract: ethers.Contract | null;

  /**
   * @param provider  An ethers Provider connected to the target network.
   * @param signer    An ethers Signer (required for write operations).
   *                  Pass null for read-only use.
   */
  constructor(provider: ethers.Provider, signer: ethers.Signer | null = null) {
    this.provider = provider;
    this.signer = signer;
    this.resolverContract = null;
    this.factoryContract = null;
  }

  /**
   * Initialize the resolver contract.
   * Must be called before any write operation.
   * Reads the resolver address from ENS_CONFIG.AEGIS_RESOLVER_ADDRESS.
   *
   * Throws if AEGIS_RESOLVER_ADDRESS is not set in ens.config.ts.
   */
  async init(): Promise<void> {
    if (!ENS_CONFIG.AEGIS_RESOLVER_ADDRESS) {
      throw new Error(
        "AEGIS_RESOLVER_ADDRESS is not set in config/ens.config.ts. " +
        "Deploy AegisENSResolver first and paste the address into ENS_CONFIG."
      );
    }

    const contractRunner = this.signer ?? this.provider;

    this.resolverContract = new ethers.Contract(
      ENS_CONFIG.AEGIS_RESOLVER_ADDRESS,
      AegisENSResolverAbi.abi,
      contractRunner
    );

    // Factory is optional — only initialized if address is set.
    // Read-only methods on AegisENS work without the factory.
    if (ENS_CONFIG.AEGIS_FACTORY_ADDRESS) {
      this.factoryContract = new ethers.Contract(
        ENS_CONFIG.AEGIS_FACTORY_ADDRESS,
        AegisFactoryAbi.abi,
        contractRunner
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Namehash helper
  // ---------------------------------------------------------------------------

  /**
   * Compute the ENS namehash of a subdomain.
   * Example: namehash("alice.0xaegis.eth")
   * Always use this to compute nodes — do not compute manually.
   */
  static namehash(name: string): string {
    return ethers.namehash(name);
  }

  /**
   * Build the full subdomain name for an agent.
   * Example: agentName("alice") → "alice.0xaegis.eth"
   */
  static agentName(label: string): string {
    return `${label}.${ENS_CONFIG.PARENT_DOMAIN}`;
  }

  // ---------------------------------------------------------------------------
  // Agent deployment via factory
  // ---------------------------------------------------------------------------

  /**
   * deployAgent — deploys a new AegisAccount via AegisFactory and registers it on ENS.
   *
   * This is the primary way to create a new Aegis agent. It:
   *   1. Predicts the account address before deployment (so ENS registration
   *      can be bundled or the address can be shared ahead of time)
   *   2. Calls AegisFactory.deployAgent() to deploy the AegisAccount via CREATE2
   *   3. Registers the new account on AegisENSResolver under <label>.0xaegis.eth
   *   4. Publishes the agent's capability profile as ENS text records
   *   5. Returns the deployed account address and ENS name
   *
   * @param label        Short name for the agent, e.g. "alice" → alice.0xaegis.eth
   * @param ownerAddress The Ethereum address that will own this agent account
   * @param oracleAddress The oracle address authorized to call deprecateECDSA()
   * @param pubKeyHash   keccak256 of the agent's 1952-byte ML-DSA public key
   *                     Get this from: wallet.publicKeyHash() in the SDK
   * @param profile      Optional capability profile to publish as ENS text records
   * @param extraSalt    Optional bytes32 salt for CREATE2 uniqueness. Pass ethers.ZeroHash
   *                     for most cases. Only needed if the same owner deploys multiple
   *                     accounts with the same pubKeyHash.
   *
   * @returns            { accountAddress, ensName, txHash }
   */
  async deployAgent(
    label: string,
    ownerAddress: string,
    oracleAddress: string,
    pubKeyHash: string,
    profile?: {
      capabilities?: string;
      endpoint?: string;
      price?: string;
      model?: string;
      uptime?: string;
    },
    extraSalt: string = ethers.ZeroHash
  ): Promise<{
    accountAddress: string;
    ensName: string;
    txHash: string;
  }> {
    this._requireResolver();

    if (!this.factoryContract) {
      throw new Error(
        "AegisFactory is not initialized. " +
        "Set ENS_CONFIG.AEGIS_FACTORY_ADDRESS in config/ens.config.ts and call init() again."
      );
    }

    const ensName = AegisENS.agentName(label);

    // Step 1: Predict the address before deployment
    const predicted: string = await this.factoryContract.predictAddressFull(
      ownerAddress,
      oracleAddress,
      pubKeyHash,
      extraSalt
    );
    console.log(`[AegisENS] Predicted account address: ${predicted}`);

    // Step 2: Deploy the AegisAccount via factory
    console.log(`[AegisENS] Deploying AegisAccount for ${ensName}…`);
    const deployTx = await this.factoryContract.deployAgent(
      ownerAddress,
      oracleAddress,
      pubKeyHash,
      extraSalt
    );
    const receipt = await deployTx.wait();
    console.log(`[AegisENS] Deployment confirmed. Tx: ${deployTx.hash}`);

    // Step 3: Read the actual deployed address from the AgentDeployed event
    // The event signature is: AgentDeployed(address indexed account, address indexed owner, address indexed oracle, bytes32 pubKeyHash, bytes32 salt)
    let accountAddress = predicted; // fallback to predicted
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.factoryContract.interface.parseLog(log);
          if (parsed && parsed.name === "AgentDeployed") {
            accountAddress = parsed.args.account;
            break;
          }
        } catch {
          // log belongs to a different contract, skip
        }
      }
    }
    console.log(`[AegisENS] Deployed at: ${accountAddress}`);

    // Step 4: Register on ENS resolver
    await this.registerAgent(label, accountAddress, pubKeyHash);

    // Step 5: Publish capability profile if provided
    if (profile) {
      await this.publishProfile(label, {
        capabilities: profile.capabilities ?? "",
        endpoint: profile.endpoint ?? "",
        price: profile.price ?? "0",
        model: profile.model ?? "",
        uptime: profile.uptime ?? "100",
        keyScheme: "ml-dsa-65",
      });
    }

    return {
      accountAddress,
      ensName,
      txHash: deployTx.hash,
    };
  }

  /**
   * predictAgentAddress — predict the address of an account before deployment.
   * Use this when you need the address for something (like funding it) before
   * calling deployAgent().
   *
   * @param ownerAddress  Owner address
   * @param oracleAddress Oracle address
   * @param pubKeyHash    keccak256 of the ML-DSA public key
   * @param extraSalt     Same extraSalt you will pass to deployAgent()
   *
   * @returns The predicted account address as a hex string
   */
  async predictAgentAddress(
    ownerAddress: string,
    oracleAddress: string,
    pubKeyHash: string,
    extraSalt: string = ethers.ZeroHash
  ): Promise<string> {
    if (!this.factoryContract) {
      throw new Error(
        "AegisFactory is not initialized. Set ENS_CONFIG.AEGIS_FACTORY_ADDRESS."
      );
    }
    return this.factoryContract.predictAddressFull(
      ownerAddress,
      oracleAddress,
      pubKeyHash,
      extraSalt
    );
  }

  /**
   * isAegisAccount — check whether an address was deployed by the Aegis factory.
   * Use this to verify that a contract is a legitimate Aegis agent account
   * before trusting a ZK proof from it.
   *
   * @param address  The address to check
   * @returns        true if deployed by AegisFactory, false otherwise
   */
  async isAegisAccount(address: string): Promise<boolean> {
    if (!this.factoryContract) return false;
    return this.factoryContract.isAegisAccount(address);
  }

  // ---------------------------------------------------------------------------
  // Agent registration
  // ---------------------------------------------------------------------------

  /**
   * Register a new agent subdomain.
   *
   * @param label           Short name for the agent e.g. "alice" → alice.0xaegis.eth
   * @param accountAddress  The agent's deployed AegisAccount contract address
   * @param pubKeyHash      keccak256 of the agent's 1952-byte ML-DSA public key (bytes32 hex)
   *
   * Writes to on-chain resolver. Signer must be the resolver owner.
   * Returns the transaction receipt.
   */
  async registerAgent(
    label: string,
    accountAddress: string,
    pubKeyHash: string
  ): Promise<ethers.TransactionReceipt> {
    this._requireResolver();
    const node = ethers.namehash(AegisENS.agentName(label));
    const tx = await this.resolverContract!.registerAgent(node, accountAddress, pubKeyHash);
    const receipt = await tx.wait();
    console.log(`[AegisENS] Registered: ${AegisENS.agentName(label)} → ${accountAddress}`);
    return receipt;
  }

  /**
   * Rotate an agent's public key hash after key rotation.
   *
   * @param label        The agent's subdomain label e.g. "alice"
   * @param newPubKeyHash keccak256 of the new ML-DSA public key (bytes32 hex)
   */
  async rotateKey(label: string, newPubKeyHash: string): Promise<ethers.TransactionReceipt> {
    this._requireResolver();
    const node = ethers.namehash(AegisENS.agentName(label));
    const tx = await this.resolverContract!.rotateKey(node, newPubKeyHash);
    const receipt = await tx.wait();
    console.log(`[AegisENS] Key rotated: ${AegisENS.agentName(label)}`);
    return receipt;
  }

  // ---------------------------------------------------------------------------
  // Agent resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve an agent name to its on-chain record.
   *
   * @param label  Agent subdomain label e.g. "alice"
   * @returns      { accountAddress, pubKeyHash, exists }
   */
  async resolveAgent(label: string): Promise<{
    accountAddress: string;
    pubKeyHash: string;
    exists: boolean;
    name: string;
  }> {
    this._requireResolver();
    const name = AegisENS.agentName(label);
    const node = ethers.namehash(name);
    const record = await this.resolverContract!.getAgentRecord(node);
    return {
      accountAddress: record.accountAddress,
      pubKeyHash: record.pubKeyHash,
      exists: record.exists,
      name,
    };
  }

  /**
   * Read a text record from an agent subdomain.
   *
   * @param label  Agent subdomain label e.g. "alice"
   * @param key    Text record key (use ENS_CONFIG.TEXT_RECORD_KEYS values)
   */
  async getText(label: string, key: string): Promise<string> {
    this._requireResolver();
    const node = ethers.namehash(AegisENS.agentName(label));
    return this.resolverContract!.text(node, key);
  }

  /**
   * Read all standard capability text records for an agent in one call.
   * Returns an object with all ENS_CONFIG.TEXT_RECORD_KEYS values.
   */
  async getAgentProfile(label: string): Promise<{
    capabilities: string;
    endpoint: string;
    price: string;
    model: string;
    uptime: string;
    keyScheme: string;
    keyRotatedAt: string;
  }> {
    this._requireResolver();
    const node = ethers.namehash(AegisENS.agentName(label));
    const keys = ENS_CONFIG.TEXT_RECORD_KEYS;

    const [capabilities, endpoint, price, model, uptime, keyScheme, keyRotatedAt] =
      await Promise.all([
        this.resolverContract!.text(node, keys.CAPABILITIES),
        this.resolverContract!.text(node, keys.ENDPOINT),
        this.resolverContract!.text(node, keys.PRICE),
        this.resolverContract!.text(node, keys.MODEL),
        this.resolverContract!.text(node, keys.UPTIME),
        this.resolverContract!.text(node, keys.KEY_SCHEME),
        this.resolverContract!.text(node, keys.KEY_ROTATED_AT),
      ]);

    return { capabilities, endpoint, price, model, uptime, keyScheme, keyRotatedAt };
  }

  // ---------------------------------------------------------------------------
  // Agent capability publishing
  // ---------------------------------------------------------------------------

  /**
   * Publish an agent's capabilities and metadata as ENS text records.
   *
   * @param label    Agent subdomain label e.g. "alice"
   * @param profile  Object containing the agent's capability data
   */
  async publishProfile(
    label: string,
    profile: {
      capabilities: string;  // comma-separated: "trade,escrow,data-fetch"
      endpoint: string;      // "https://alice.example.com/rpc"
      price: string;         // "0.001" (ETH per operation)
      model: string;         // "gpt-4o"
      uptime: string;        // "99.5"
      keyScheme?: string;    // defaults to "ml-dsa-65"
    }
  ): Promise<ethers.TransactionReceipt> {
    this._requireResolver();
    const node = ethers.namehash(AegisENS.agentName(label));
    const keys = ENS_CONFIG.TEXT_RECORD_KEYS;

    const keysList = [
      keys.CAPABILITIES,
      keys.ENDPOINT,
      keys.PRICE,
      keys.MODEL,
      keys.UPTIME,
      keys.KEY_SCHEME,
      keys.KEY_ROTATED_AT,
    ];

    const valuesList = [
      profile.capabilities,
      profile.endpoint,
      profile.price,
      profile.model,
      profile.uptime,
      profile.keyScheme ?? "ml-dsa-65",
      new Date().toISOString(),
    ];

    const tx = await this.resolverContract!.setTextBatch(node, keysList, valuesList);
    const receipt = await tx.wait();
    console.log(`[AegisENS] Profile published: ${AegisENS.agentName(label)}`);
    return receipt;
  }

  // ---------------------------------------------------------------------------
  // Oracle threat feed
  // ---------------------------------------------------------------------------

  /**
   * Publish a threat status update to threat.0xaegis.eth.
   * Called by the QuantumOracle after computing a new threat score.
   *
   * @param score          Numeric threat score 0–100
   * @param ecdsaSafe      Whether ECDSA is still considered safe
   * @param triggeredBy    Array of active threat factor names
   */
  async publishThreatStatus(
    score: number,
    ecdsaSafe: boolean,
    triggeredBy: string[]
  ): Promise<ethers.TransactionReceipt> {
    this._requireResolver();
    const node = ethers.namehash(ENS_CONFIG.THREAT_FEED_DOMAIN);
    const threatKeys = ENS_CONFIG.THREAT_RECORD_KEYS;

    const keys = [
      threatKeys.SCORE,
      threatKeys.ECDSA_SAFE,
      threatKeys.LAST_UPDATED,
      threatKeys.TRIGGERED_BY,
      threatKeys.RECOMMENDED_ACTION,
    ];

    const values = [
      score.toString(),
      ecdsaSafe.toString(),
      Math.floor(Date.now() / 1000).toString(),
      triggeredBy.join(","),
      ecdsaSafe ? "monitor" : "deprecate_ecdsa",
    ];

    const tx = await this.resolverContract!.setTextBatch(node, keys, values);
    const receipt = await tx.wait();
    console.log(`[AegisENS] Threat status published. Score: ${score}, ECDSA safe: ${ecdsaSafe}`);
    return receipt;
  }

  /**
   * Read the current threat status from threat.0xaegis.eth.
   * Any agent, wallet, or dapp can call this at any time.
   *
   * Returns the parsed threat state.
   */
  async readThreatStatus(): Promise<{
    score: number;
    ecdsaSafe: boolean;
    lastUpdated: number;
    triggeredBy: string[];
    recommendedAction: string;
  }> {
    this._requireResolver();
    const node = ethers.namehash(ENS_CONFIG.THREAT_FEED_DOMAIN);
    const threatKeys = ENS_CONFIG.THREAT_RECORD_KEYS;

    const [score, ecdsaSafe, lastUpdated, triggeredBy, recommendedAction] = await Promise.all([
      this.resolverContract!.text(node, threatKeys.SCORE),
      this.resolverContract!.text(node, threatKeys.ECDSA_SAFE),
      this.resolverContract!.text(node, threatKeys.LAST_UPDATED),
      this.resolverContract!.text(node, threatKeys.TRIGGERED_BY),
      this.resolverContract!.text(node, threatKeys.RECOMMENDED_ACTION),
    ]);

    return {
      score: parseInt(score || "0"),
      ecdsaSafe: ecdsaSafe !== "false",
      lastUpdated: parseInt(lastUpdated || "0"),
      triggeredBy: triggeredBy ? triggeredBy.split(",").filter(Boolean) : [],
      recommendedAction: recommendedAction || "monitor",
    };
  }

  // ---------------------------------------------------------------------------
  // Agent-to-agent PQ handshake
  // ---------------------------------------------------------------------------

  /**
   * Perform a post-quantum identity handshake with another agent.
   *
   * How it works:
   *   1. Resolve the counterpart's ENS name to get their pubKeyHash
   *   2. Generate a random 32-byte nonce (the challenge)
   *   3. Return the nonce for you to send to the counterpart off-chain
   *   4. After the counterpart returns their signature, call verifyHandshake()
   *
   * @param counterpartLabel  ENS label of the agent you want to verify e.g. "bob"
   * @returns                 { nonce, pubKeyHash, accountAddress, name }
   */
  async initiateHandshake(counterpartLabel: string): Promise<{
    nonce: Uint8Array;
    nonceHex: string;
    pubKeyHash: string;
    accountAddress: string;
    name: string;
  }> {
    const record = await this.resolveAgent(counterpartLabel);
    if (!record.exists) {
      throw new Error(`[AegisENS] Agent not registered: ${record.name}`);
    }

    const nonce = ethers.randomBytes(32);
    const nonceHex = ethers.hexlify(nonce);

    console.log(`[AegisENS] Handshake initiated with ${record.name}`);
    console.log(`[AegisENS] Challenge nonce: ${nonceHex}`);
    console.log(`[AegisENS] Send this nonce to ${record.name} and ask for an ML-DSA signature`);

    return {
      nonce,
      nonceHex,
      pubKeyHash: record.pubKeyHash,
      accountAddress: record.accountAddress,
      name: record.name,
    };
  }

  /**
   * Verify a handshake response from a counterpart agent.
   *
   * @param nonce          The 32-byte nonce you generated in initiateHandshake()
   * @param signature      The ML-DSA signature returned by the counterpart
   * @param fullPubKey     The counterpart's full 1952-byte ML-DSA public key
   *                       (fetched from CCIP-Read gateway or provided directly)
   * @param expectedPubKeyHash  The pubKeyHash on-chain for this agent
   *                            (from resolveAgent().pubKeyHash)
   * @returns              true if the handshake is valid — the counterpart proved
   *                       ownership of the registered PQ key
   */
  async verifyHandshake(
    nonce: Uint8Array,
    signature: Uint8Array,
    fullPubKey: Uint8Array,
    expectedPubKeyHash: string
  ): Promise<boolean> {
    // Step 1: Verify the pubKey matches the on-chain hash
    const computedHash = ethers.keccak256(fullPubKey);
    if (computedHash.toLowerCase() !== expectedPubKeyHash.toLowerCase()) {
      console.error("[AegisENS] pubKey hash mismatch — key does not match on-chain record");
      return false;
    }

    // Step 2: Verify the ML-DSA signature over the nonce
    const { ml_dsa65 } = await import("@noble/post-quantum/ml-dsa");
    const valid = ml_dsa65.verify(fullPubKey, nonce, signature);

    if (valid) {
      console.log("[AegisENS] Handshake verified. Agent identity confirmed (post-quantum).");
    } else {
      console.error("[AegisENS] Handshake failed. Signature invalid.");
    }

    return valid;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _requireResolver(): void {
    if (!this.resolverContract) {
      throw new Error(
        "AegisENS is not initialized. Call await aegisEns.init() before using write methods."
      );
    }
  }
}
