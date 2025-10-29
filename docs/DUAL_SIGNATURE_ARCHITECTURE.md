# Dual-Signature Architecture for Tether WDK

## Overview

This document describes the architecture for adding Post-Quantum Cryptography (PQC) support to the Tether Wallet Development Kit (WDK) through a dual-signature system that supports both ECDSA (for Ethereum compatibility) and ML-DSA (for quantum resistance).

## Motivation

- **Quantum Threat**: Quantum computers pose a future threat to elliptic curve cryptography
- **Transition Period**: Need for hybrid approach during the transition to post-quantum algorithms
- **Off-chain Verification**: Secondary network for ML-DSA signature verification
- **Backward Compatibility**: Maintain full Ethereum mainnet compatibility

## Architecture Design

### Core Principles

1. **Non-invasive Integration**: Use WDK's protocol pattern for extensibility
2. **Deterministic Key Generation**: Both key types derived from same BIP-39 seed
3. **Separation of Concerns**: Clear separation between ECDSA and ML-DSA operations
4. **Memory Safety**: Secure handling and disposal of cryptographic material

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Application                   │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                    WDK Manager                       │
│  - Wallet registration and management                │
│  - Protocol registration system                      │
│  - Middleware pipeline                               │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐        ┌────────▼────────┐
│  EVM Wallet    │        │ Other Wallets   │
│   (ECDSA)      │        │                 │
└───────┬────────┘        └─────────────────┘
        │
┌───────▼────────────────────────────────────┐
│        DualSignatureProtocol               │
│  ┌──────────────┬──────────────┐          │
│  │ ECDSA Signer │ ML-DSA Signer│          │
│  └──────────────┴──────────────┘          │
│  - signWithECDSA()                         │
│  - signWithMLDSA()                         │
│  - dualSign()                              │
└────────────────────────────────────────────┘
```

## Key Derivation Strategy

### Hierarchical Deterministic (HD) Path Separation

Both ECDSA and ML-DSA keys are derived from the same BIP-39 mnemonic seed using different derivation paths:

- **ECDSA Path**: `m/44'/60'/account'/0/index`
  - Standard Ethereum BIP-44 path
  - Coin type 60 for Ethereum

- **ML-DSA Path**: `m/44'/9000'/account'/0/index`
  - Custom path for post-quantum keys
  - Coin type 9000 (experimental range)

### Derivation Process

```
BIP-39 Mnemonic
      │
      ▼
  512-bit Seed
      │
      ├─────────────────────┐
      │                     │
      ▼                     ▼
  BIP-32 Master Key    BIP-32 Master Key
      │                     │
      │                     │
  m/44'/60'/0'/0/0     m/44'/9000'/0'/0/0
      │                     │
      ▼                     ▼
  ECDSA KeyPair        ML-DSA Seed (32 bytes)
  (secp256k1)                │
                             ▼
                        ML-DSA KeyPair
                        (Dilithium-65)
```

## Component Architecture

### 1. Dual Key Derivation Module

**File**: `src/crypto/dual-key-derivation.js`

**Responsibilities**:
- Derive ECDSA keys using BIP-32
- Generate ML-DSA keys from derived seed
- Ensure deterministic generation
- Secure memory management

**Key Methods**:
- `deriveECDSAKey(accountIndex, addressIndex)`
- `deriveMLDSAKey(accountIndex, addressIndex)`
- `dispose()`

### 2. ECDSA Signer

**File**: `src/crypto/ecdsa-signer.js`

**Responsibilities**:
- secp256k1 curve operations
- Ethereum address generation
- EIP-191 message signing
- Transaction signing

**Key Methods**:
- `sign(data)` - Returns ECDSA signature (r, s, v)
- `getAddress()` - Returns Ethereum address
- `getPublicKey()` - Returns secp256k1 public key

### 3. ML-DSA Signer

**File**: `src/crypto/mldsa-signer.js`

**Responsibilities**:
- ML-DSA-65 (FIPS 204) operations
- Custom address format generation
- Quantum-resistant signing

**Key Methods**:
- `sign(data)` - Returns ML-DSA signature
- `getAddress()` - Returns custom ML-DSA address
- `getPublicKey()` - Returns ML-DSA public key

### 4. DualSignatureProtocol

**File**: `src/protocols/dual-signature-protocol.js`

**Responsibilities**:
- Protocol integration with WDK
- Coordinate dual signing operations
- Manage both signer instances
- Provide unified API

**Key Methods**:
- `signWithECDSA(data)` - On-chain signature
- `signWithMLDSA(data)` - Off-chain signature
- `dualSign(data)` - Both signatures
- `getAddresses()` - Both address formats
- `getPublicKeys()` - Both public keys

## Data Structures

### ECDSA Signature
```javascript
{
  r: "0x...",           // 32 bytes hex
  s: "0x...",           // 32 bytes hex
  v: 27,                // Recovery parameter
  signature: "0x...",   // Compact signature (65 bytes)
  messageHash: "0x..."  // Keccak256 hash
}
```

### ML-DSA Signature
```javascript
{
  signature: Uint8Array,      // ~3,293 bytes
  signatureHex: "0x...",      // Hex encoded
  algorithm: "ML-DSA-65",     // Algorithm identifier
  publicKey: Uint8Array       // 1,952 bytes
}
```

### Dual Signature
```javascript
{
  ecdsa: ECDSASignature,
  mldsa: MLDSASignature,
  data: Uint8Array | string,
  timestamp: number
}
```

## API Design

### Basic Usage

```javascript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { DualSignatureProtocol } from '@tetherto/wdk-core/protocols'

// Initialize WDK with dual-signature support
const wdk = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, config)
  .registerProtocol('ethereum', 'dual', DualSignatureProtocol, {
    ecdsaEnabled: true,
    mldsaEnabled: true
  })

// Get account with dual-signature capability
const account = await wdk.getAccount('ethereum', 0)
const dualSig = account.getDualSignatureProtocol('dual')

// Sign for on-chain (ECDSA)
const ecdsaSignature = await dualSig.signWithECDSA(transaction)

// Sign for off-chain (ML-DSA)
const mldsaSignature = await dualSig.signWithMLDSA(transaction)

// Create both signatures
const dualSignature = await dualSig.dualSign(transaction)
```

### Transaction Flow

```javascript
// Hybrid transaction: on-chain + off-chain verification
async function hybridTransaction(account, txData) {
  const dualSig = account.getDualSignatureProtocol('dual')

  // 1. Sign with ECDSA for Ethereum
  const ecdsaSig = await dualSig.signWithECDSA(txData)

  // 2. Send transaction to Ethereum
  const txHash = await account.sendTransaction(txData)

  // 3. Sign with ML-DSA for verification network
  const mldsaSig = await dualSig.signWithMLDSA(txData)

  // 4. Submit to off-chain verification network
  await submitToVerificationNetwork({
    txHash,
    mldsaSignature: mldsaSig,
    txData
  })

  return { txHash, dualSignature: { ecdsa: ecdsaSig, mldsa: mldsaSig }}
}
```

## Security Considerations

### Key Management
- Keys derived on-demand, not stored persistently
- Secure memory disposal after use
- No key material in logs or error messages

### Signature Security
- ECDSA provides current security (128-bit classical)
- ML-DSA provides quantum resistance (NIST Level 3)
- Independent signature generation prevents correlation

### Implementation Security
- Use audited cryptographic libraries
- Constant-time operations where applicable
- Protection against side-channel attacks

## Performance Considerations

### Key Generation
- ECDSA: ~1ms per key
- ML-DSA: ~5-10ms per key
- Keys cached during session

### Signing Operations
- ECDSA: ~1-2ms per signature
- ML-DSA: ~10-20ms per signature
- Parallel signing for dual operations

### Memory Usage
- ECDSA private key: 32 bytes
- ML-DSA private key: 4,032 bytes
- ML-DSA public key: 1,952 bytes
- ML-DSA signature: ~3,293 bytes

## Migration Path

### Phase 1: Foundation
- Implement core cryptographic modules
- Basic key derivation and signing

### Phase 2: Integration
- WDK protocol integration
- Wallet account extension

### Phase 3: Network Integration
- Off-chain verification network client
- Hybrid transaction support

### Phase 4: Production
- Security audit
- Performance optimization
- Documentation and examples

## Dependencies

### Required Libraries
- `@noble/curves` - ECDSA implementation
- `@noble/hashes` - Cryptographic hash functions
- `@scure/bip32` - HD key derivation
- `@scure/bip39` - Mnemonic handling

### ML-DSA Implementation Options
1. `@noble/post-quantum` (when available)
2. `dilithium-crystals` (WASM bindings)
3. Custom implementation based on NIST FIPS 204

## Testing Strategy

### Unit Tests
- Key derivation determinism
- Signature generation/verification
- Address generation

### Integration Tests
- Protocol registration
- Account integration
- Dual signing operations

### End-to-End Tests
- Full transaction flow
- Verification network integration
- Error handling

## Future Enhancements

### Planned Features
1. Multiple ML-DSA security levels (44/65/87)
2. Signature aggregation for batch operations
3. Hardware wallet support
4. Threshold signatures

### Potential Optimizations
1. WASM acceleration for ML-DSA
2. Parallel signature generation
3. Signature caching
4. Key pre-computation

## References

- [NIST FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) - Module-Lattice-Based Digital Signature Standard
- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) - Hierarchical Deterministic Wallets
- [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) - Mnemonic code for generating deterministic keys
- [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) - Multi-Account Hierarchy
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) - Signed Data Standard

## Conclusion

This dual-signature architecture provides a clean, extensible path for adding post-quantum cryptography to the Tether WDK while maintaining full backward compatibility with existing Ethereum infrastructure. The protocol-based approach ensures minimal disruption to existing code while providing maximum flexibility for future enhancements.