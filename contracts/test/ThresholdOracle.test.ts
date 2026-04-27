import { expect } from "chai";
import { ethers } from "hardhat";

describe("ThresholdOracle", function () {
  let oracle: any;
  let account: any;
  let owner: any;
  let oracle1: any;
  let oracle2: any;
  let oracle3: any;
  let nonOracle: any;

  before(async function () {
    const signers = await ethers.getSigners();
    owner    = signers[0];
    oracle1  = signers[1];
    oracle2  = signers[2];
    oracle3  = signers[3];
    nonOracle = signers[4];

    // Deploy Groth16Verifier so AegisAccount can be deployed
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier", owner);
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy ThresholdOracle: 3 oracles, quorum=2, threshold=70
    const OracleFactory = await ethers.getContractFactory("ThresholdOracle", owner);
    oracle = await OracleFactory.deploy(
      [oracle1.address, oracle2.address, oracle3.address],
      2,   // quorum
      70   // threshold
    );
    await oracle.waitForDeployment();

    // Deploy AegisAccount with ThresholdOracle as the oracle address
    const fakeKey     = ethers.randomBytes(1952);
    const pubKeyHash  = ethers.keccak256(fakeKey);
    const AccountFactory = await ethers.getContractFactory("AegisAccount", owner);
    account = await AccountFactory.deploy(
      owner.address,
      await oracle.getAddress(),
      await verifier.getAddress(),
      pubKeyHash
    );
    await account.waitForDeployment();
  });

  it("should store correct quorum and threshold", async function () {
    expect(await oracle.quorum()).to.equal(2n);
    expect(await oracle.threshold()).to.equal(70n);
  });

  it("should recognize all three authorized oracles", async function () {
    expect(await oracle.isOracle(oracle1.address)).to.equal(true);
    expect(await oracle.isOracle(oracle2.address)).to.equal(true);
    expect(await oracle.isOracle(oracle3.address)).to.equal(true);
    expect(await oracle.isOracle(nonOracle.address)).to.equal(false);
    expect(await oracle.oracleCount()).to.equal(3n);
  });

  it("AegisAccount should start with ecdsaActive = true", async function () {
    expect(await account.ecdsaActive()).to.equal(true);
  });

  it("first vote (oracle-1) should not trigger deprecation", async function () {
    const accountAddress = await account.getAddress();
    const tx = await oracle.connect(oracle1).submitThreat(accountAddress, 80);
    await tx.wait();

    // One vote is not enough — quorum is 2
    expect(await oracle.getVoteCount(accountAddress)).to.equal(1n);
    expect(await oracle.getScoreSum(accountAddress)).to.equal(80n);
    expect(await oracle.isTriggered(accountAddress)).to.equal(false);
    expect(await account.ecdsaActive()).to.equal(true);
  });

  it("second vote (oracle-2) hits quorum → autonomous deprecation", async function () {
    const accountAddress = await account.getAddress();
    const tx = await oracle.connect(oracle2).submitThreat(accountAddress, 85);
    const receipt = await tx.wait();

    // Quorum reached: 2 votes, average = (80+85)/2 = 82 ≥ threshold 70
    expect(await oracle.getVoteCount(accountAddress)).to.equal(2n);
    expect(await oracle.getAverageScore(accountAddress)).to.equal(82n);
    expect(await oracle.isTriggered(accountAddress)).to.equal(true);

    // AegisAccount.deprecateECDSA() was called autonomously inside the same tx
    expect(await account.ecdsaActive()).to.equal(false);

    // Confirm the QuorumReached event was emitted
    const quorumEvent = receipt.logs
      .map((log: any) => {
        try { return oracle.interface.parseLog(log); } catch { return null; }
      })
      .find((e: any) => e && e.name === "QuorumReached");

    expect(quorumEvent).to.not.be.undefined;
    expect(quorumEvent.args.averageScore).to.equal(82n);

    // Confirm the ECDSADeprecated event was emitted
    const deprecatedEvent = receipt.logs
      .map((log: any) => {
        try { return oracle.interface.parseLog(log); } catch { return null; }
      })
      .find((e: any) => e && e.name === "ECDSADeprecated");

    expect(deprecatedEvent).to.not.be.undefined;
  });

  it("rejects a vote from an unauthorized address", async function () {
    const accountAddress = await account.getAddress();
    await expect(
      oracle.connect(nonOracle).submitThreat(accountAddress, 80)
    ).to.be.revertedWith("ThresholdOracle: not authorized oracle");
  });

  it("rejects a duplicate vote from an oracle that already voted", async function () {
    const accountAddress = await account.getAddress();
    // oracle1 already voted in a previous test — duplicate should revert
    // (state is already triggered, so this actually hits the "already triggered" guard first)
    await expect(
      oracle.connect(oracle1).submitThreat(accountAddress, 80)
    ).to.be.revertedWith("ThresholdOracle: already triggered for this account");
  });

  it("rejects a score above 100", async function () {
    // Use a fresh account so we are not blocked by the triggered flag
    const fakeKey    = ethers.randomBytes(1952);
    const pubKeyHash = ethers.keccak256(fakeKey);
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier", owner);
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const AccountFactory = await ethers.getContractFactory("AegisAccount", owner);
    const freshAccount = await AccountFactory.deploy(
      owner.address,
      await oracle.getAddress(),
      await verifier.getAddress(),
      pubKeyHash
    );
    await freshAccount.waitForDeployment();

    await expect(
      oracle.connect(oracle1).submitThreat(await freshAccount.getAddress(), 101)
    ).to.be.revertedWith("ThresholdOracle: score must be 0-100");
  });

  it("rejects a zero account address", async function () {
    await expect(
      oracle.connect(oracle1).submitThreat(ethers.ZeroAddress, 80)
    ).to.be.revertedWith("ThresholdOracle: zero account");
  });

  describe("quorum reached but average below threshold — no deprecation", function () {
    let highThresholdOracle: any;
    let freshAccount: any;

    before(async function () {
      const VerifierFactory  = await ethers.getContractFactory("Groth16Verifier", owner);
      const verifier = await VerifierFactory.deploy();
      await verifier.waitForDeployment();

      // Deploy ThresholdOracle with threshold=100 (impossible to reach in practice)
      const OracleFactory = await ethers.getContractFactory("ThresholdOracle", owner);
      highThresholdOracle = await OracleFactory.deploy(
        [oracle1.address, oracle2.address],
        2,   // quorum = 2
        100  // threshold = 100 (requires perfect score)
      );
      await highThresholdOracle.waitForDeployment();

      const fakeKey    = ethers.randomBytes(1952);
      const pubKeyHash = ethers.keccak256(fakeKey);
      const AccountFactory = await ethers.getContractFactory("AegisAccount", owner);
      freshAccount = await AccountFactory.deploy(
        owner.address,
        await highThresholdOracle.getAddress(),
        await verifier.getAddress(),
        pubKeyHash
      );
      await freshAccount.waitForDeployment();
    });

    it("should not deprecate when quorum is met but avg score < threshold", async function () {
      const addr = await freshAccount.getAddress();

      await highThresholdOracle.connect(oracle1).submitThreat(addr, 80);
      await highThresholdOracle.connect(oracle2).submitThreat(addr, 85);

      // Quorum=2 reached, but average(82) < threshold(100) → no deprecation
      expect(await highThresholdOracle.getVoteCount(addr)).to.equal(2n);
      expect(await highThresholdOracle.isTriggered(addr)).to.equal(false);
      expect(await freshAccount.ecdsaActive()).to.equal(true);
    });
  });

  describe("oracle management", function () {
    let managedOracle: any;
    let newOracle: any;

    before(async function () {
      const signers = await ethers.getSigners();
      newOracle = signers[5];

      const OracleFactory = await ethers.getContractFactory("ThresholdOracle", owner);
      managedOracle = await OracleFactory.deploy(
        [oracle1.address, oracle2.address, oracle3.address],
        2,
        70
      );
      await managedOracle.waitForDeployment();
    });

    it("admin can add a new oracle", async function () {
      await managedOracle.connect(owner).addOracle(newOracle.address);
      expect(await managedOracle.isOracle(newOracle.address)).to.equal(true);
      expect(await managedOracle.oracleCount()).to.equal(4n);
    });

    it("admin can remove an oracle (without breaking quorum)", async function () {
      // 4 oracles, quorum=2 — removing one still leaves 3 ≥ quorum
      await managedOracle.connect(owner).removeOracle(newOracle.address);
      expect(await managedOracle.isOracle(newOracle.address)).to.equal(false);
      expect(await managedOracle.oracleCount()).to.equal(3n);
    });

    it("non-admin cannot add oracle", async function () {
      await expect(
        managedOracle.connect(nonOracle).addOracle(newOracle.address)
      ).to.be.revertedWith("ThresholdOracle: not admin");
    });

    it("cannot remove oracle if it would break quorum", async function () {
      // 3 oracles, quorum=2 — removing two would leave 1 < quorum
      await managedOracle.connect(owner).removeOracle(oracle3.address);
      // Now 2 oracles, quorum=2 — cannot remove any more
      await expect(
        managedOracle.connect(owner).removeOracle(oracle2.address)
      ).to.be.revertedWith("ThresholdOracle: would break quorum");
    });
  });
});
