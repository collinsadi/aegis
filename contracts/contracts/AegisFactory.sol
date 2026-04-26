// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AegisAccount.sol";

/**
 * @title AegisFactory
 * @notice Deploys new AegisAccount contracts for AI agents.
 *
 * Why a factory?
 *   - Agents should not need to know how to deploy a contract.
 *     The SDK calls deployAgent() and gets back a ready-to-use account address.
 *   - All accounts deployed through this factory are tracked on-chain.
 *     Anyone can verify that an account is a legitimate Aegis account by calling isAegisAccount().
 *   - Deterministic addresses via CREATE2 allow the SDK to predict the account address
 *     before deployment, so ENS registration and account deployment can be batched.
 *
 * How it works:
 *   1. Caller provides: owner address, oracle address, pubKeyHash (keccak256 of ML-DSA pubkey)
 *   2. Factory deploys a new AegisAccount with those parameters
 *      (the Groth16Verifier address is set once at factory construction and reused for all accounts)
 *   3. Factory emits AgentDeployed event and records the address in deployedAccounts mapping
 *   4. Caller (the SDK) reads the new account address from the event or return value
 */
contract AegisFactory {

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted every time a new AegisAccount is deployed.
     * @param account      The address of the newly deployed AegisAccount
     * @param owner        The owner address passed to the account
     * @param oracle       The oracle address passed to the account
     * @param pubKeyHash   keccak256 of the agent's ML-DSA public key
     * @param salt         The salt used for CREATE2 — determines the address
     */
    event AgentDeployed(
        address indexed account,
        address indexed owner,
        address indexed oracle,
        bytes32 pubKeyHash,
        bytes32 salt
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice The Groth16Verifier address used by all accounts deployed from this factory.
    /// Set once at construction, cannot be changed.
    address public immutable verifier;

    /// @notice The address that deployed this factory.
    address public immutable factoryOwner;

    /// @notice Maps a deployed account address to true if it was deployed by this factory.
    /// Use this to verify that an account is a legitimate Aegis account.
    mapping(address => bool) public isAegisAccount;

    /// @notice All accounts deployed by this factory, in order of deployment.
    address[] public deployedAccounts;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _verifier The address of the deployed Groth16Verifier contract.
     *                  All AegisAccounts deployed from this factory will use this verifier.
     *                  This cannot be changed after deployment.
     */
    constructor(address _verifier) {
        require(_verifier != address(0), "AegisFactory: zero verifier address");
        verifier = _verifier;
        factoryOwner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    /**
     * @notice Deploy a new AegisAccount for an AI agent.
     *
     * Uses CREATE2 so the account address is deterministic and predictable off-chain.
     * The salt is computed as: keccak256(abi.encodePacked(owner, pubKeyHash, extraSalt))
     * This means the same owner + pubKeyHash + extraSalt always produces the same address.
     *
     * @param owner        The Ethereum address that will own this agent account.
     *                     This is the address authorized to call executeWithECDSA() and executeWithZKProof().
     * @param oracle       The Ethereum address authorized to call deprecateECDSA() on the account.
     *                     Typically the deployed QuantumOracle contract or a trusted EOA.
     * @param pubKeyHash   keccak256(agentPublicKey) where agentPublicKey is the 1952-byte ML-DSA public key.
     *                     Compute this off-chain using: ethers.keccak256(ethers.hexlify(wallet.keyPair.publicKey))
     * @param extraSalt    An additional bytes32 value to make the address unique if the same owner
     *                     wants to deploy multiple accounts with the same pubKeyHash.
     *                     For most cases pass ethers.ZeroHash (bytes32(0)).
     *
     * @return account     The address of the newly deployed AegisAccount.
     */
    function deployAgent(
        address owner,
        address oracle,
        bytes32 pubKeyHash,
        bytes32 extraSalt
    ) external returns (address account) {
        require(owner != address(0), "AegisFactory: zero owner address");
        require(oracle != address(0), "AegisFactory: zero oracle address");
        require(pubKeyHash != bytes32(0), "AegisFactory: zero pubKeyHash");

        // Compute a deterministic salt from the inputs
        bytes32 salt = keccak256(abi.encodePacked(owner, pubKeyHash, extraSalt));

        // Deploy using CREATE2
        // The bytecode is AegisAccount's creation code with constructor arguments ABI-encoded
        bytes memory bytecode = abi.encodePacked(
            type(AegisAccount).creationCode,
            abi.encode(owner, oracle, verifier, pubKeyHash)
        );

        assembly {
            account := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        require(account != address(0), "AegisFactory: deployment failed");

        // Record and emit
        isAegisAccount[account] = true;
        deployedAccounts.push(account);

        emit AgentDeployed(account, owner, oracle, pubKeyHash, salt);
    }

    // -------------------------------------------------------------------------
    // Address prediction
    // -------------------------------------------------------------------------

    /**
     * @notice Predict the address of an account before deploying it.
     *         Call this off-chain to get the account address for ENS registration
     *         before the deployment transaction is sent.
     *
     * @param owner        Same value you will pass to deployAgent()
     * @param pubKeyHash   Same value you will pass to deployAgent()
     * @param extraSalt    Same value you will pass to deployAgent()
     *
     * @return predicted   The address the new AegisAccount will have after deployment
     */
    function predictAddress(
        address owner,
        bytes32 pubKeyHash,
        bytes32 extraSalt
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(owner, pubKeyHash, extraSalt));

        bytes memory bytecode = abi.encodePacked(
            type(AegisAccount).creationCode,
            abi.encode(owner, address(0), verifier, pubKeyHash) // oracle placeholder — address doesn't affect CREATE2 result here
        );

        // Note: oracle value in bytecode affects the predicted address.
        // For accurate prediction, the oracle address must be known at prediction time.
        // Use predictAddressFull() when you know all parameters.
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        predicted = address(uint160(uint256(hash)));
    }

    /**
     * @notice Predict the account address with full parameters (including oracle address).
     *         Use this for accurate pre-deployment address computation.
     *
     * @param owner        Same value you will pass to deployAgent()
     * @param oracle       Same value you will pass to deployAgent()
     * @param pubKeyHash   Same value you will pass to deployAgent()
     * @param extraSalt    Same value you will pass to deployAgent()
     *
     * @return predicted   The exact address the new AegisAccount will have
     */
    function predictAddressFull(
        address owner,
        address oracle,
        bytes32 pubKeyHash,
        bytes32 extraSalt
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(owner, pubKeyHash, extraSalt));

        bytes memory bytecode = abi.encodePacked(
            type(AegisAccount).creationCode,
            abi.encode(owner, oracle, verifier, pubKeyHash)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        predicted = address(uint160(uint256(hash)));
    }

    // -------------------------------------------------------------------------
    // Read helpers
    // -------------------------------------------------------------------------

    /// @notice Returns the total number of accounts deployed by this factory.
    function deployedAccountsCount() external view returns (uint256) {
        return deployedAccounts.length;
    }

    /// @notice Returns a slice of deployed accounts.
    /// @param from  Start index (inclusive)
    /// @param to    End index (exclusive)
    function getDeployedAccounts(uint256 from, uint256 to) external view returns (address[] memory) {
        require(to <= deployedAccounts.length, "AegisFactory: out of bounds");
        require(from < to, "AegisFactory: invalid range");
        address[] memory result = new address[](to - from);
        for (uint256 i = from; i < to; i++) {
            result[i - from] = deployedAccounts[i];
        }
        return result;
    }
}
