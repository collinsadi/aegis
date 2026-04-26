// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AegisENSResolver
 * @notice CCIP-Read resolver for *.0xaegis.eth agent subdomains.
 *
 * Stores on-chain (cheap, always available):
 *   - pubKeyHash: keccak256 of the agent's 1952-byte ML-DSA public key
 *   - accountAddress: the agent's deployed AegisAccount contract address
 *
 * Stores off-chain (served via CCIP-Read gateway):
 *   - Full 1952-byte ML-DSA public key
 *   - Key scheme identifier
 *   - Key rotation timestamp
 *
 * Any ENS client that calls addr() or text() on a *.0xaegis.eth name
 * will get the on-chain data directly. Any client that calls pubKey()
 * will get an OffchainLookup revert pointing to the CCIP-Read gateway.
 */
contract AegisENSResolver {

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown by CCIP-Read when the full public key is requested.
    /// The client must call the gateway URL and then call pubKeyWithProof().
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgentRegistered(bytes32 indexed node, address accountAddress, bytes32 pubKeyHash);
    event AgentKeyRotated(bytes32 indexed node, bytes32 newPubKeyHash);
    event TextRecordSet(bytes32 indexed node, string key, string value);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice The address that deployed this contract. Only owner can register agents.
    address public immutable owner;

    /// @notice The CCIP-Read gateway URL. Points to the off-chain key server.
    string public gatewayUrl;

    /// @notice On-chain record for each agent subdomain.
    struct AgentRecord {
        address accountAddress;  // The agent's AegisAccount contract
        bytes32 pubKeyHash;      // keccak256 of the 1952-byte ML-DSA public key
        bool exists;
    }

    /// @notice Maps ENS namehash of the agent subdomain to its record.
    mapping(bytes32 => AgentRecord) public agentRecords;

    /// @notice ENS text records for each agent subdomain.
    /// node => key => value
    mapping(bytes32 => mapping(string => string)) public textRecords;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _gatewayUrl The CCIP-Read gateway URL.
     *        Example: "https://gateway.0xaegis.eth/{sender}/{data}.json"
     */
    constructor(string memory _gatewayUrl) {
        owner = msg.sender;
        gatewayUrl = _gatewayUrl;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Update the CCIP-Read gateway URL. Only callable by owner.
    function setGatewayUrl(string calldata _gatewayUrl) external {
        require(msg.sender == owner, "AegisENSResolver: not owner");
        gatewayUrl = _gatewayUrl;
    }

    // -------------------------------------------------------------------------
    // Agent registration
    // -------------------------------------------------------------------------

    /**
     * @notice Register a new agent subdomain.
     * @param node The ENS namehash of the agent's subdomain.
     *             Compute off-chain: ethers.namehash("alice.0xaegis.eth")
     * @param accountAddress The deployed AegisAccount contract address for this agent.
     * @param pubKeyHash keccak256 of the agent's 1952-byte ML-DSA public key.
     */
    function registerAgent(
        bytes32 node,
        address accountAddress,
        bytes32 pubKeyHash
    ) external {
        require(msg.sender == owner, "AegisENSResolver: not owner");
        require(!agentRecords[node].exists, "AegisENSResolver: agent already registered");
        require(accountAddress != address(0), "AegisENSResolver: zero address");
        require(pubKeyHash != bytes32(0), "AegisENSResolver: zero pubKeyHash");

        agentRecords[node] = AgentRecord({
            accountAddress: accountAddress,
            pubKeyHash: pubKeyHash,
            exists: true
        });

        emit AgentRegistered(node, accountAddress, pubKeyHash);
    }

    /**
     * @notice Rotate an agent's public key hash.
     *         Called after the agent generates a new ML-DSA keypair.
     * @param node The ENS namehash of the agent's subdomain.
     * @param newPubKeyHash keccak256 of the new ML-DSA public key.
     */
    function rotateKey(bytes32 node, bytes32 newPubKeyHash) external {
        require(msg.sender == owner, "AegisENSResolver: not owner");
        require(agentRecords[node].exists, "AegisENSResolver: agent not registered");
        require(newPubKeyHash != bytes32(0), "AegisENSResolver: zero pubKeyHash");

        agentRecords[node].pubKeyHash = newPubKeyHash;
        emit AgentKeyRotated(node, newPubKeyHash);
    }

    // -------------------------------------------------------------------------
    // ENS resolver interface — addr()
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the AegisAccount address for the given subdomain node.
     *         This is what ENS clients call to resolve a name to an address.
     */
    function addr(bytes32 node) external view returns (address) {
        return agentRecords[node].accountAddress;
    }

    // -------------------------------------------------------------------------
    // ENS resolver interface — text()
    // -------------------------------------------------------------------------

    /**
     * @notice Returns a text record for the given subdomain node and key.
     * @param node The ENS namehash.
     * @param key  The text record key (use ENS_CONFIG.TEXT_RECORD_KEYS values).
     */
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return textRecords[node][key];
    }

    /**
     * @notice Set a text record for the given subdomain node.
     *         Only callable by owner (the Aegis protocol or oracle).
     */
    function setText(bytes32 node, string calldata key, string calldata value) external {
        require(msg.sender == owner, "AegisENSResolver: not owner");
        textRecords[node][key] = value;
        emit TextRecordSet(node, key, value);
    }

    /**
     * @notice Set multiple text records in a single transaction.
     *         keys[i] maps to values[i].
     */
    function setTextBatch(
        bytes32 node,
        string[] calldata keys,
        string[] calldata values
    ) external {
        require(msg.sender == owner, "AegisENSResolver: not owner");
        require(keys.length == values.length, "AegisENSResolver: length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            textRecords[node][keys[i]] = values[i];
            emit TextRecordSet(node, keys[i], values[i]);
        }
    }

    // -------------------------------------------------------------------------
    // CCIP-Read — pubKey() triggers off-chain lookup
    // -------------------------------------------------------------------------

    /**
     * @notice Request the full ML-DSA public key for an agent.
     *
     * This function ALWAYS reverts with OffchainLookup.
     * The CCIP-Read client (ethers.js, viem, etc.) catches this revert,
     * calls the gateway URL with the encoded node, receives the full public key,
     * and then calls pubKeyWithProof() to verify the on-chain hash.
     *
     * @param node The ENS namehash of the agent subdomain.
     */
    function pubKey(bytes32 node) external view returns (bytes memory) {
        require(agentRecords[node].exists, "AegisENSResolver: agent not registered");

        string[] memory urls = new string[](1);
        urls[0] = gatewayUrl;

        // callData encodes the node so the gateway knows which key to return
        bytes memory callData = abi.encode(node);

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            AegisENSResolver.pubKeyWithProof.selector,
            callData  // extraData passed back to pubKeyWithProof
        );
    }

    /**
     * @notice CCIP-Read callback. Called by the client after the gateway responds.
     *
     * @param result  ABI-encoded bytes returned by the gateway: abi.encode(fullPubKey)
     *                where fullPubKey is the 1952-byte ML-DSA public key.
     * @param extraData The original callData (ABI-encoded node) passed through from pubKey().
     *
     * Verifies that keccak256(fullPubKey) matches the on-chain pubKeyHash.
     * Returns the full public key if valid.
     */
    function pubKeyWithProof(
        bytes calldata result,
        bytes calldata extraData
    ) external view returns (bytes memory) {
        bytes32 node = abi.decode(extraData, (bytes32));
        bytes memory fullPubKey = abi.decode(result, (bytes));

        require(agentRecords[node].exists, "AegisENSResolver: agent not registered");
        require(
            keccak256(fullPubKey) == agentRecords[node].pubKeyHash,
            "AegisENSResolver: pubKey hash mismatch"
        );

        return fullPubKey;
    }

    // -------------------------------------------------------------------------
    // Read helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the on-chain record for an agent subdomain.
     *         Use this to confirm an agent is registered and get its account address.
     */
    function getAgentRecord(bytes32 node) external view returns (
        address accountAddress,
        bytes32 pubKeyHash,
        bool exists
    ) {
        AgentRecord memory r = agentRecords[node];
        return (r.accountAddress, r.pubKeyHash, r.exists);
    }

    /**
     * @notice Returns true if supportsInterface is called with the ENS resolver
     *         interface IDs. Needed for ENS registry compatibility.
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // IAddrResolver: 0x3b3b57de
        // ITextResolver: 0x59d1d43c
        // IExtendedResolver (CCIP-Read): 0x9061b923
        return interfaceId == 0x3b3b57de
            || interfaceId == 0x59d1d43c
            || interfaceId == 0x9061b923
            || interfaceId == 0x01ffc9a7; // ERC-165
    }
}
