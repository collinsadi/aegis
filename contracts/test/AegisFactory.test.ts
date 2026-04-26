import { expect } from "chai";
import { ethers } from "hardhat";

describe("AegisFactory", function () {
  let factory: any;
  let verifier: any;
  let owner: any;
  let oracle: any;
  let stranger: any;
  const fakePubKey = ethers.randomBytes(1952);
  const fakePubKeyHash = ethers.keccak256(fakePubKey);

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    oracle = signers[1];
    stranger = signers[2];

    // Deploy verifier first
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier", owner);
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy factory
    const FactoryContract = await ethers.getContractFactory("AegisFactory", owner);
    factory = await FactoryContract.deploy(await verifier.getAddress());
    await factory.waitForDeployment();
  });

  it("should store the verifier address", async function () {
    expect(await factory.verifier()).to.equal(await verifier.getAddress());
  });

  it("should deploy a new AegisAccount and emit AgentDeployed", async function () {
    const ownerAddr = await owner.getAddress();
    const oracleAddr = await oracle.getAddress();

    const tx = await factory.deployAgent(
      ownerAddr,
      oracleAddr,
      fakePubKeyHash,
      ethers.ZeroHash
    );
    const receipt = await tx.wait();

    // Check event was emitted
    const event = receipt.logs
      .map((log: any) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      })
      .find((e: any) => e && e.name === "AgentDeployed");

    expect(event).to.not.be.undefined;
    expect(event.args.owner).to.equal(ownerAddr);
    expect(event.args.oracle).to.equal(oracleAddr);
    expect(event.args.pubKeyHash).to.equal(fakePubKeyHash);

    const accountAddress = event.args.account;
    expect(accountAddress).to.not.equal(ethers.ZeroAddress);

    // Verify the account is registered in the factory
    expect(await factory.isAegisAccount(accountAddress)).to.equal(true);
  });

  it("should track deployed accounts count", async function () {
    const count = await factory.deployedAccountsCount();
    expect(count).to.be.greaterThan(0n);
  });

  it("should predict the address correctly before deployment", async function () {
    const ownerAddr = await stranger.getAddress();
    const oracleAddr = await oracle.getAddress();
    const newPubKeyHash = ethers.keccak256(ethers.randomBytes(1952));
    const extraSalt = ethers.ZeroHash;

    // Predict address
    const predicted = await factory.predictAddressFull(
      ownerAddr,
      oracleAddr,
      newPubKeyHash,
      extraSalt
    );

    // Deploy
    const tx = await factory.connect(stranger).deployAgent(
      ownerAddr,
      oracleAddr,
      newPubKeyHash,
      extraSalt
    );
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log: any) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      })
      .find((e: any) => e && e.name === "AgentDeployed");

    expect(event.args.account.toLowerCase()).to.equal(predicted.toLowerCase());
  });

  it("should reject zero owner address", async function () {
    await expect(
      factory.deployAgent(
        ethers.ZeroAddress,
        await oracle.getAddress(),
        fakePubKeyHash,
        ethers.ZeroHash
      )
    ).to.be.revertedWith("AegisFactory: zero owner address");
  });

  it("should reject zero oracle address", async function () {
    await expect(
      factory.deployAgent(
        await owner.getAddress(),
        ethers.ZeroAddress,
        fakePubKeyHash,
        ethers.ZeroHash
      )
    ).to.be.revertedWith("AegisFactory: zero oracle address");
  });

  it("should reject zero pubKeyHash", async function () {
    await expect(
      factory.deployAgent(
        await owner.getAddress(),
        await oracle.getAddress(),
        ethers.ZeroHash,
        ethers.ZeroHash
      )
    ).to.be.revertedWith("AegisFactory: zero pubKeyHash");
  });

  it("deployed account should have correct owner and verifier", async function () {
    const count = await factory.deployedAccountsCount();
    const accounts = await factory.getDeployedAccounts(0n, count);
    const lastAccount = accounts[accounts.length - 1];

    const AegisAccountFactory = await ethers.getContractFactory("AegisAccount", owner);
    const account = AegisAccountFactory.attach(lastAccount);

    expect(await account.verifier()).to.equal(await verifier.getAddress());
  });
});
