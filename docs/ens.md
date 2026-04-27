# Aegis ENS Integration — Deep Dive

**Network:** Ethereum Sepolia Testnet  
**Name:** `0xaegis.eth`  
**Owner:** `0xdD3EeF74f9B68025CEddA2406B70e51a2Ed6A0b9`  
**Aegis Resolver:** `0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c`  

---

## Why ENS

ENS is not a convenience layer in Aegis. It is the identity, discovery, trust, and threat-broadcast infrastructure the entire protocol depends on. Every agent has an ENS subdomain. The quantum threat oracle publishes to ENS. Agent-to-agent authentication is anchored to ENS names. No component of Aegis works correctly without ENS.

---

## Agent Identity via CCIP-Read

Every agent deployed through Aegis gets a subdomain under `0xaegis.eth`. The resolver is a custom CCIP-Read contract (EIP-3668).

On-chain it stores only two things — cheap and permanent:
- A 32-byte `pubKeyHash` (keccak256 of the ML-DSA public key)
- The agent's `AegisAccount` contract address

The full 1952-byte ML-DSA public key lives off-chain, served by the CCIP-Read gateway on demand. When the gateway responds, the on-chain hash is checked. Forgery is cryptographically impossible — you cannot submit a fake key that hashes to the value stored on-chain.

```
resolve("alice.0xaegis.eth")
    ├── On-chain:  accountAddress + keccak256(pubKey)  [32 bytes, permanent]
    └── CCIP-Read: full 1952-byte ML-DSA public key, hash-verified on every call
```

The 0G integration makes the gateway stateless — keys are stored on 0G decentralised storage rather than Postgres, so the off-chain component can scale or restart without losing data.

---

## Global Quantum Threat Feed

The quantum oracle writes live threat status to a single canonical name: `threat.0xaegis.eth`. Any agent, wallet, or dapp on any chain reads from this name.

```
threat.0xaegis.eth text records:
    score             → "90"
    ecdsaSafe         → "false"
    triggeredBy       → "logical_qubits_above_1000,secp256k1_cve_published"
    recommendedAction → "deprecate_ecdsa"
    lastUpdated       → "1718000000"
```

One oracle update propagates instantly to every consumer. No subscriptions, no webhooks, no centralized API. The threat feed is readable by any Ethereum client without authentication.

---

## Agent Discovery

Agents publish capabilities, pricing, and endpoints as ENS text records on their subdomain. Any agent that needs to find a counterpart queries ENS subgraph records filtered by capability.

```
alice.0xaegis.eth text records:
    capabilities  → "trade,escrow,data-fetch"
    endpoint      → "https://alice.yourapp.com/rpc"
    price         → "0.001"
    model         → "gpt-4o"
    uptime        → "99.9"
    keyScheme     → "ml-dsa-65"
    keyRotatedAt  → "2024-11-01T00:00:00Z"
```

No registry contract. No API key. No permission needed to list. The entire agent marketplace is a set of ENS text record queries.

---

## Post-Quantum Agent Handshake

When two agents transact, they run a PQ credential handshake anchored to their ENS names. ECDSA never touches this flow.

```
A resolves "bob.0xaegis.eth"  →  gets pubKeyHash (on-chain)
A sends random nonce          →  B signs with ML-DSA secret key
B returns signature           →  A fetches full pubKey via CCIP-Read
A verifies: keccak256(pubKey) === pubKeyHash   ✓
A verifies: ml_dsa65.verify(pubKey, nonce, sig)  ✓
Trust established. Transaction proceeds.
```

A quantum computer watching the entire exchange gains nothing — there is no ECDSA private key to extract.

---

## Registration Transactions

| # | Title | Function | Contract | Tx Hash | Remark |
|---|-------|----------|----------|---------|--------|
| 1 | Commit | `commit(bytes32)` | [ETHRegistrarController](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) | [0x7ead8b…](https://sepolia.etherscan.io/tx/0x7ead8bda52d0377c845ae52449c71e5f6b70baada0e9619949766560f0cf5ce3) | Submits the commitment hash on-chain. Must wait ≥ 60 s before registering. |
| 2 | Register | `register(tuple)` | [ETHRegistrarController](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) | [0x84c2ad…](https://sepolia.etherscan.io/tx/0x84c2ad38d75dd5530c952328f865cd6d23d6973a1dfa9fa80b6c02e57e26da36) | Registers `0xaegis.eth` for 1 year (~0.00344 ETH). |
| 3 | Set Resolver | `setResolver(bytes32,address)` | [ENS Registry](https://sepolia.etherscan.io/address/0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e) | [0x980384…](https://sepolia.etherscan.io/tx/0x980384fdce8b31bd68d675e8950220dda6a44472bd0b529f158095b79e657153) | Points `0xaegis.eth` to `AegisENSResolver`. |
| 4 | Set subdomainRegistrar | `setText(bytes32,string,string)` | [AegisENSResolver](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) | [0xe7931b…](https://sepolia.etherscan.io/tx/0xe7931bf58c08a28d5f859db1bb34e4db4f8d2d605f6c015eebd320fd6fb41c31) | Declares `AegisENSResolver` as authority for all `*.0xaegis.eth` subdomains. |

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| ENS Registry | [0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e](https://sepolia.etherscan.io/address/0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e) |
| ETHRegistrarController (V2) | [0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) |
| Public Resolver | [0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5](https://sepolia.etherscan.io/address/0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5) |
| AegisENSResolver | [0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) |
