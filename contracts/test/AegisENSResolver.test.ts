import { expect } from "chai";
import { ethers } from "hardhat";
import { ENS_CONFIG } from "../../config/ens.config";

describe("AegisENSResolver", function () {
  let resolver: any;
  let owner: any;
  let stranger: any;

  // Sample agent data
  const agentName = "alice.0xaegis.eth";
  const agentNode = ethers.namehash(agentName);
  const fakePubKey = ethers.randomBytes(1952);
  const fakePubKeyHash = ethers.keccak256(fakePubKey);
  let fakeAccountAddress: string;

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    stranger = signers[1];
    fakeAccountAddress = await signers[2].getAddress();

    const ResolverFactory = await ethers.getContractFactory("AegisENSResolver", owner);
    resolver = await ResolverFactory.deploy(ENS_CONFIG.CCIP_GATEWAY_URL_LOCAL);
    await resolver.waitForDeployment();
  });

  it("should deploy with correct gateway URL", async function () {
    expect(await resolver.gatewayUrl()).to.equal(ENS_CONFIG.CCIP_GATEWAY_URL_LOCAL);
  });

  it("should register a new agent", async function () {
    await resolver.registerAgent(agentNode, fakeAccountAddress, fakePubKeyHash);
    const record = await resolver.getAgentRecord(agentNode);
    expect(record.exists).to.equal(true);
    expect(record.accountAddress).to.equal(fakeAccountAddress);
    expect(record.pubKeyHash).to.equal(fakePubKeyHash);
  });

  it("should resolve addr() to the agent's account address", async function () {
    expect(await resolver.addr(agentNode)).to.equal(fakeAccountAddress);
  });

  it("should reject duplicate registration", async function () {
    await expect(
      resolver.registerAgent(agentNode, fakeAccountAddress, fakePubKeyHash)
    ).to.be.revertedWith("AegisENSResolver: agent already registered");
  });

  it("should reject registration from non-owner", async function () {
    const otherNode = ethers.namehash("bob.0xaegis.eth");
    await expect(
      resolver.connect(stranger).registerAgent(otherNode, fakeAccountAddress, fakePubKeyHash)
    ).to.be.revertedWith("AegisENSResolver: not owner");
  });

  it("should set and retrieve a text record", async function () {
    await resolver.setText(agentNode, ENS_CONFIG.TEXT_RECORD_KEYS.CAPABILITIES, "trade,escrow");
    expect(
      await resolver.text(agentNode, ENS_CONFIG.TEXT_RECORD_KEYS.CAPABILITIES)
    ).to.equal("trade,escrow");
  });

  it("should set multiple text records in batch", async function () {
    const keys = [
      ENS_CONFIG.TEXT_RECORD_KEYS.ENDPOINT,
      ENS_CONFIG.TEXT_RECORD_KEYS.PRICE,
      ENS_CONFIG.TEXT_RECORD_KEYS.UPTIME,
    ];
    const values = ["https://alice.example.com/rpc", "0.001", "99.5"];
    await resolver.setTextBatch(agentNode, keys, values);
    expect(await resolver.text(agentNode, ENS_CONFIG.TEXT_RECORD_KEYS.ENDPOINT)).to.equal(values[0]);
    expect(await resolver.text(agentNode, ENS_CONFIG.TEXT_RECORD_KEYS.PRICE)).to.equal(values[1]);
    expect(await resolver.text(agentNode, ENS_CONFIG.TEXT_RECORD_KEYS.UPTIME)).to.equal(values[2]);
  });

  it("should rotate a key", async function () {
    const newKey = ethers.randomBytes(1952);
    const newHash = ethers.keccak256(newKey);
    await resolver.rotateKey(agentNode, newHash);
    const record = await resolver.getAgentRecord(agentNode);
    expect(record.pubKeyHash).to.equal(newHash);
  });

  it("pubKey() should revert with OffchainLookup (CCIP-Read)", async function () {
    // Restore original hash first
    await resolver.rotateKey(agentNode, fakePubKeyHash);
    // pubKey() must always revert with OffchainLookup — never return directly
    await expect(resolver.pubKey(agentNode)).to.be.reverted;
  });

  it("pubKeyWithProof() should verify correct key and reject tampered key", async function () {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], [fakePubKey]);
    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [agentNode]);
    const result = await resolver.pubKeyWithProof(encoded, extraData);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], result);
    expect(decoded[0]).to.equal(ethers.hexlify(fakePubKey));

    // Tampered key should be rejected
    const tamperedKey = ethers.randomBytes(1952);
    const tamperedEncoded = ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], [tamperedKey]);
    await expect(
      resolver.pubKeyWithProof(tamperedEncoded, extraData)
    ).to.be.revertedWith("AegisENSResolver: pubKey hash mismatch");
  });

  it("should support required ENS interface IDs", async function () {
    expect(await resolver.supportsInterface("0x3b3b57de")).to.equal(true); // IAddrResolver
    expect(await resolver.supportsInterface("0x59d1d43c")).to.equal(true); // ITextResolver
    expect(await resolver.supportsInterface("0x9061b923")).to.equal(true); // IExtendedResolver
  });
});
