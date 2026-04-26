# Aegis ENS Transactions

**Network:** Ethereum Sepolia Testnet  
**Name:** `0xaegis.eth`  
**Owner:** `0xdD3EeF74f9B68025CEddA2406B70e51a2Ed6A0b9`  
**Aegis Resolver:** `0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c`  

---

## Registration Flow

| # | Title | Function | Contract | Tx Hash | Remark |
|---|-------|----------|----------|---------|--------|
| 1 | Commit | `commit(bytes32)` | [ETHRegistrarController](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) | [0x7ead8b...](https://sepolia.etherscan.io/tx/0x7ead8bda52d0377c845ae52449c71e5f6b70baada0e9619949766560f0cf5ce3) | Submits the commitment hash on-chain to begin the commit-reveal registration. Must wait ≥ 60 s before registering. |
| 2 | Register | `register(tuple)` | [ETHRegistrarController](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) | [0x84c2ad...](https://sepolia.etherscan.io/tx/0x84c2ad38d75dd5530c952328f865cd6d23d6973a1dfa9fa80b6c02e57e26da36) | Registers `0xaegis.eth` for 1 year, paying ~0.00344 ETH (base price + 10% buffer). Sets owner and Public Resolver. |
| 3 | Set Resolver | `setResolver(bytes32,address)` | [ENS Registry](https://sepolia.etherscan.io/address/0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e) | [0x980384...](https://sepolia.etherscan.io/tx/0x980384fdce8b31bd68d675e8950220dda6a44472bd0b529f158095b79e657153) | Points `0xaegis.eth` to the custom `AegisENSResolver` contract instead of the default Public Resolver. |
| 4 | Set subdomainRegistrar | `setText(bytes32,string,string)` | [AegisENSResolver](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) | [0xe7931b...](https://sepolia.etherscan.io/tx/0xe7931bf58c08a28d5f859db1bb34e4db4f8d2d605f6c015eebd320fd6fb41c31) | Sets the `subdomainRegistrar` text record on `0xaegis.eth` to `AegisENSResolver`, declaring it as the authority for all `*.0xaegis.eth` subdomains. |

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| ENS Registry | [0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e](https://sepolia.etherscan.io/address/0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e) |
| ETHRegistrarController (V2) | [0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968](https://sepolia.etherscan.io/address/0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968) |
| Public Resolver | [0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5](https://sepolia.etherscan.io/address/0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5) |
| AegisENSResolver | [0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) |
