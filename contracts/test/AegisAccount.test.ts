import { expect } from "chai";
import { ethers } from "hardhat";
import { AegisWallet } from "../../sdk/src/wallet";
import { AegisProver } from "../../sdk/src/prover";
import { QuantumOracle } from "../../sdk/src/oracle";

describe("AegisAccount", function () {
  // Increase timeout to 120 seconds because ZK proof generation takes time
  this.timeout(120000);

  let verifierAddress: string;
  let accountContract: any;
  let aliceWallet: AegisWallet;
  let prover: AegisProver;
  let owner: any;
  let oracleSigner: any;

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    oracleSigner = signers[1];

    // Deploy verifier
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier", owner);
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();

    // Create wallet
    aliceWallet = new AegisWallet("test-alice");

    // Deploy account
    const AccountFactory = await ethers.getContractFactory("AegisAccount", owner);
    accountContract = await AccountFactory.deploy(
      await owner.getAddress(),
      await oracleSigner.getAddress(),
      verifierAddress,
      aliceWallet.publicKeyHash() as `0x${string}`
    );
    await accountContract.waitForDeployment();

    // Fund account
    await owner.sendTransaction({
      to: await accountContract.getAddress(),
      value: ethers.parseEther("1")
    });

    prover = await AegisProver.create();
  });

  it("should have ecdsaActive = true on deploy", async function () {
    expect(await accountContract.ecdsaActive()).to.equal(true);
  });

  it("should verify a valid ZK proof and execute", async function () {
    const message = ethers.toUtf8Bytes("test-operation-001");
    const signedOp = aliceWallet.sign(message);

    const proofOutput = await prover.prove(
      signedOp.signature,
      message,
      aliceWallet.publicKeyHash()
    );

    const formatted = AegisProver.formatProofForSolidity(proofOutput.proof, proofOutput.publicSignals);

    const tx = await accountContract.connect(owner).executeWithZKProof(
      formatted.pA,
      formatted.pB,
      formatted.pC,
      proofOutput.commitment,
      await owner.getAddress(),
      0n,
      "0x"
    );
    await tx.wait();

    expect(await accountContract.nonce()).to.equal(1n);
  });

  it("should allow oracle to deprecate ECDSA", async function () {
    await accountContract.connect(oracleSigner).deprecateECDSA();
    expect(await accountContract.ecdsaActive()).to.equal(false);
  });

  it("should reject ECDSA after deprecation", async function () {
    const fakeMsg = ethers.randomBytes(32);
    const sig = await owner.signMessage(fakeMsg);
    await expect(
      accountContract.connect(owner).executeWithECDSA(
        sig,
        ethers.hashMessage(fakeMsg),
        await owner.getAddress(),
        0n,
        "0x"
      )
    ).to.be.revertedWith("AegisAccount: ECDSA has been deprecated");
  });

  it("oracle threat score triggers deprecation at threshold", function () {
    const oracle = new QuantumOracle();
    expect(oracle.shouldDeprecate()).to.equal(false);

    oracle.activateFactor("nist_pqc_fully_deployed");
    oracle.activateFactor("logical_qubits_above_1000");
    oracle.activateFactor("secp256k1_cve_published");

    expect(oracle.getThreatScore()).to.equal(90);
    expect(oracle.shouldDeprecate()).to.equal(true);
  });
});
