# Aegis Deployed Contracts & On-Chain Transactions

**Network:** Ethereum Sepolia Testnet (chain ID 11155111)  
**Explorer:** [sepolia.etherscan.io](https://sepolia.etherscan.io)  

---

## Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|---------|
| `AegisFactory` | `0x529754f82E4cDFc7063b944D5A1F86138B115a40` | [View](https://sepolia.etherscan.io/address/0x529754f82E4cDFc7063b944D5A1F86138B115a40) |
| `AegisENSResolver` | `0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c` | [View](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) |
| `Groth16Verifier` | `0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6` | [View](https://sepolia.etherscan.io/address/0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6) |
| `ThresholdOracle` | `0xB7cc1D4D49783f803f193b64a074249601C27187` | [View](https://sepolia.etherscan.io/address/0xB7cc1D4D49783f803f193b64a074249601C27187) |
| `AegisAccount` (aria-f0pi) | `0x0a23Fa822D8BF5e0Bc13c79817a641e586cE9D38` | [View](https://sepolia.etherscan.io/address/0x0a23Fa822D8BF5e0Bc13c79817a641e586cE9D38) |
| `AegisAccount` (demo instance 2) | `0x7DcCcE806abE51d1c78cBa3A39F35b6d9bCE0780` | [View](https://sepolia.etherscan.io/address/0x7DcCcE806abE51d1c78cBa3A39F35b6d9bCE0780) |

`AegisAccount` is deployed per-agent via `AegisFactory` using CREATE2. Each agent gets a deterministic wallet address derived from its ENS label and owner address.

---

## ENS Setup Transactions

| # | Action | Function | Contract | Tx |
|---|--------|----------|----------|----|
| 1 | ENS Commit | `commit(bytes32)` | ETHRegistrarController | [0x7ead8b…](https://sepolia.etherscan.io/tx/0x7ead8bda52d0377c845ae52449c71e5f6b70baada0e9619949766560f0cf5ce3) |
| 2 | Register `0xaegis.eth` | `register(tuple)` | ETHRegistrarController | [0x84c2ad…](https://sepolia.etherscan.io/tx/0x84c2ad38d75dd5530c952328f865cd6d23d6973a1dfa9fa80b6c02e57e26da36) |
| 3 | Set Custom Resolver | `setResolver(bytes32,address)` | ENS Registry | [0x980384…](https://sepolia.etherscan.io/tx/0x980384fdce8b31bd68d675e8950220dda6a44472bd0b529f158095b79e657153) |
| 4 | Set subdomainRegistrar | `setText(bytes32,string,string)` | AegisENSResolver | [0xe7931b…](https://sepolia.etherscan.io/tx/0xe7931bf58c08a28d5f859db1bb34e4db4f8d2d605f6c015eebd320fd6fb41c31) |

---

## Demo Agent Transactions (aria-f0pi)

| # | Action | Function | Contract | Tx |
|---|--------|----------|----------|----|
| 5 | Deploy AegisAccount | `deployAccount(bytes32,address,address)` | AegisFactory | [0xe6312f…](https://sepolia.etherscan.io/tx/0xe6312fae77e3a08fb211f309de36b68898af4754fb1baaa2a27e97c343a60608) |
| 6 | Register ENS subdomain | `registerAgent(string,address,bytes32)` | AegisENSResolver | [0x5410b0…](https://sepolia.etherscan.io/tx/0x5410b0a66dd415fe33443339868b96a0fffe1e1518a05679a307696901b73756) |
| 7 | ZK Payment (0.001 ETH) | `executeWithZKProof(...)` | AegisAccount | [0xc34e0a…](https://sepolia.etherscan.io/tx/0xc34e0ab35fd9a14bdc1eda1f7dbd273753f2009d95ba61cecad21c0831ca143b) |
| 8 | Deprecate ECDSA | `deprecateECDSA()` | AegisAccount | included in tx 7 |
| 9 | ZK Proof post-deprecation | `executeWithZKProof(...)` | AegisAccount | [0x282035…](https://sepolia.etherscan.io/tx/0x282035270471a2dd56daed2a2fa4d264e9b735c22f46fb493884caac0ea046b4) |
| 10 | Update Gateway URL | `setGatewayUrl(...)` | AegisENSResolver | [0xbdac9a…](https://sepolia.etherscan.io/tx/0xbdac9ab9d6e703205e283471904ddfe06da197ac61fbdfa4684d913a14b6e8d8) |

Proof generation is off-chain (~0.4 s). On-chain verification uses the BN254 Groth16 pairing check at ~200k gas.

---

## 0G Storage Transactions

See [docs/0g.md](./0g.md#transaction-log) for the full 0G transaction log.
