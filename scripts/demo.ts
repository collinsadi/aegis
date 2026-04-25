import { ethers } from "hardhat";
import { AegisWallet } from "../sdk/wallet";
import { AegisProver } from "../sdk/prover";
import { QuantumOracle } from "../sdk/oracle";

async function main() {
  console.log("=== Aegis Demo ===\n");

  // Get signers from Hardhat's local node.
  // signers[0] is the deployer.
  // signers[1] will be the oracle.
  // signers[2] will own agent Alice's account.
  // signers[3] will own agent Bob's account.
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const oracleSigner = signers[1];
  const aliceOwner = signers[2];
  const bobOwner = signers[3];

  // --- Step 1: Deploy the Groth16Verifier contract ---
  console.log("Deploying Groth16Verifier...");
  const VerifierFactory = await ethers.getContractFactory("Groth16Verifier", deployer);
  const verifierContract = await VerifierFactory.deploy();
  await verifierContract.waitForDeployment();
  const verifierAddress = await verifierContract.getAddress();
  console.log(`Groth16Verifier deployed at: ${verifierAddress}`);

  // --- Step 2: Create PQ wallets for Alice and Bob ---
  console.log("\nGenerating PQ wallets...");
  const aliceWallet = new AegisWallet("agent-alice");
  const bobWallet = new AegisWallet("agent-bob");
  console.log(`Alice pubKeyHash: ${aliceWallet.publicKeyHash()}`);
  console.log(`Bob   pubKeyHash: ${bobWallet.publicKeyHash()}`);

  // --- Step 3: Deploy AegisAccount for Alice ---
  console.log("\nDeploying AegisAccount for Alice...");
  const AccountFactory = await ethers.getContractFactory("AegisAccount", deployer);

  const alicePubKeyHashBytes32 = aliceWallet.publicKeyHash() as `0x${string}`;
  const aliceAccount = await AccountFactory.deploy(
    await aliceOwner.getAddress(),
    await oracleSigner.getAddress(),
    verifierAddress,
    alicePubKeyHashBytes32
  );
  await aliceAccount.waitForDeployment();
  const aliceAccountAddress = await aliceAccount.getAddress();
  console.log(`Alice's AegisAccount deployed at: ${aliceAccountAddress}`);

  // Fund Alice's account with 1 ETH so it can execute operations
  await deployer.sendTransaction({ to: aliceAccountAddress, value: ethers.parseEther("1") });
  console.log("Funded Alice's account with 1 ETH");

  // --- Step 4: Alice signs a message and generates a ZK proof ---
  console.log("\nAlice signing operation...");
  const prover = await AegisProver.create();

  // The message Alice is signing is the ABI encoding of a simple ETH transfer.
  // target: Bob's owner address. value: 0.01 ETH. data: empty bytes.
  const targetAddress = await bobOwner.getAddress();
  const message = ethers.toUtf8Bytes(
    `transfer:${targetAddress}:${ethers.parseEther("0.01").toString()}:nonce:0`
  );

  const signedOp = aliceWallet.sign(message);
  console.log(`Signature length: ${signedOp.signature.length} bytes`);
  console.log("Signature valid:", aliceWallet.verify(message, signedOp.signature));

  // --- Step 5: Generate ZK proof for Alice's signature ---
  console.log("\nGenerating ZK proof (this takes ~20-60 seconds)...");
  const proofOutput = await prover.prove(
    signedOp.signature,
    message,
    aliceWallet.publicKeyHash()
  );
  console.log("Proof generated successfully.");
  console.log(`Commitment: ${proofOutput.commitment.toString()}`);
  console.log(`Public signals: ${proofOutput.publicSignals}`);

  // --- Step 6: Verify the proof on-chain via Alice's AegisAccount ---
  console.log("\nSubmitting ZK proof to AegisAccount...");
  const formatted = AegisProver.formatProofForSolidity(proofOutput.proof, proofOutput.publicSignals);

  // We call executeWithZKProof with a no-op operation:
  // target = deployer address, value = 0, data = empty bytes
  // In a real agent, this would be meaningful calldata
  const tx = await aliceAccount.connect(aliceOwner).executeWithZKProof(
    formatted.pA as [string, string],
    formatted.pB as [[string, string], [string, string]],
    formatted.pC as [string, string],
    proofOutput.commitment,
    await deployer.getAddress(),
    0n,
    "0x"
  );
  await tx.wait();
  console.log(`ZK proof verified on-chain. Tx hash: ${tx.hash}`);
  console.log(`Alice's account nonce is now: ${await aliceAccount.nonce()}`);

  // --- Step 7: Oracle activates and deprecates ECDSA ---
  console.log("\n--- Quantum Oracle Demo ---");
  const oracle = new QuantumOracle();
  oracle.activateFactor("nist_pqc_fully_deployed");
  oracle.activateFactor("logical_qubits_above_1000");
  oracle.activateFactor("secp256k1_cve_published");
  console.log(oracle.getReport());

  if (oracle.shouldDeprecate()) {
    console.log("\nOracle threshold reached. Deprecating ECDSA on Alice's account...");
    const accountABI = (await ethers.getContractFactory("AegisAccount")).interface.fragments;
    await oracle.deprecateOnChain(
      aliceAccountAddress,
      oracleSigner,
      accountABI as any[]
    );
    console.log(`ecdsaActive is now: ${await aliceAccount.ecdsaActive()}`);
  }

  // --- Step 8: Confirm ECDSA is rejected after deprecation ---
  console.log("\nVerifying ECDSA is rejected...");
  const fakeMsg = ethers.randomBytes(32);
  const ecdsaSig = await aliceOwner.signMessage(fakeMsg);
  try {
    await aliceAccount.connect(aliceOwner).executeWithECDSA(
      ecdsaSig,
      ethers.hashMessage(fakeMsg),
      await deployer.getAddress(),
      0n,
      "0x"
    );
    console.log("ERROR: ECDSA should have been rejected but was not.");
  } catch (e: any) {
    console.log("Correctly rejected ECDSA:", e.reason || e.message);
  }

  console.log("\n=== Demo complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
