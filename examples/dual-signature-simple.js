#!/usr/bin/env node

/**
 * Simple Dual-Signature Example
 *
 * Minimal example showing the core API for dual-signature functionality
 */

import WDK from '../index.js'
import { DualSignatureProtocol } from '../src/protocols/dual-signature-protocol.js'

// Minimal wallet implementation
class SimpleWallet {
  constructor(seed) {
    this._seed = seed
  }

  async getAccount(index) {
    return {
      _seed: this._seed,
      accountIndex: index,
      async getSeed() { return this._seed },
      async getAccountIndex() { return index },
      async getAddressIndex() { return 0 }
    }
  }

  dispose() {
    this._seed = null
  }
}

async function main() {
  // Create wallet with a seed phrase
  const seed = 'test test test test test test test test test test test junk'
  const wdk = new WDK(seed)

  // Register wallet and protocol
  wdk.registerWallet('demo', SimpleWallet, {})
  wdk.registerProtocol('demo', 'dual', DualSignatureProtocol, {
    ecdsaEnabled: true,
    mldsaEnabled: true,
    mldsaAlgorithm: 'ML-DSA-65'
  })

  // Get account and protocol
  const account = await wdk.getAccount('demo', 0)
  const dualSig = account.getDualSignatureProtocol('dual')

  // Initialize protocol
  await dualSig.initialize()

  // Get addresses
  const addresses = await dualSig.getAddresses()
  console.log('Addresses:')
  console.log('  ECDSA (Ethereum):', addresses.ethereum)
  console.log('  ML-DSA (Quantum-resistant):', addresses.mldsa)
  console.log()

  // Sign a message with both algorithms
  const message = 'Hello, quantum world!'

  // Sign with ECDSA only
  const ecdsaSig = await dualSig.signWithECDSA(message)
  console.log('ECDSA Signature:')
  console.log('  R:', ecdsaSig.r)
  console.log('  S:', ecdsaSig.s)
  console.log('  V:', ecdsaSig.v)
  console.log()

  // Sign with ML-DSA only
  const mldsaSig = await dualSig.signWithMLDSA(message)
  console.log('ML-DSA Signature:')
  console.log('  Algorithm:', mldsaSig.algorithm)
  console.log('  Size:', mldsaSig.signature.length, 'bytes')
  console.log()

  // Sign with both at once
  const dualSignature = await dualSig.dualSign(message)
  console.log('Dual Signature:')
  console.log('  Has ECDSA:', !!dualSignature.ecdsa)
  console.log('  Has ML-DSA:', !!dualSignature.mldsa)
  console.log('  Data:', dualSignature.data)

  // Clean up
  wdk.dispose()
}

main().catch(console.error)