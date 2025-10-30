#!/usr/bin/env node

/**
 * Standalone Dual-Signature Example
 *
 * This example demonstrates the dual-signature functionality without
 * requiring any external wallet modules. Perfect for testing the
 * core dual-signature implementation.
 */

import WDK from '../index.js'
import { DualSignatureProtocol } from '../src/protocols/dual-signature-protocol.js'

// Create a minimal wallet implementation that works with our protocol
class StandaloneWallet {
  constructor(seed) {
    this._seed = seed
  }

  async getAccount(index) {
    const self = this
    return new StandaloneAccount(self._seed, index)
  }

  dispose() {
    // Clean up any sensitive data
    this._seed = null
  }
}

class StandaloneAccount {
  constructor(seed, index) {
    this._seed = seed
    this.accountIndex = index
    this._protocols = {}
  }

  async getSeed() {
    return this._seed
  }

  async getAccountIndex() {
    return this.accountIndex
  }

  async getAddressIndex() {
    return 0
  }

  registerProtocol(label, Protocol, config) {
    this._protocols[label] = new Protocol(this, config)
    return this
  }

  getDualSignatureProtocol(label = 'dual') {
    if (!this._protocols[label]) {
      // Auto-register if not found
      this.registerProtocol(label, DualSignatureProtocol, {})
    }
    return this._protocols[label]
  }

  getSwapProtocol() {
    throw new Error('Swap protocol not implemented in standalone mode')
  }

  getBridgeProtocol() {
    throw new Error('Bridge protocol not implemented in standalone mode')
  }

  getLendingProtocol() {
    throw new Error('Lending protocol not implemented in standalone mode')
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║        STANDALONE DUAL-SIGNATURE DEMONSTRATION              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // Generate or use provided seed
  const seed = process.env.SEED_PHRASE || WDK.getRandomSeedPhrase()

  console.log('🔑 Wallet Seed Phrase:')
  console.log(`   "${seed}"`)
  console.log('   (Save this to recover your wallet)\n')

  // Initialize WDK with our standalone wallet
  const wdk = new WDK(seed)
  wdk.registerWallet('standalone', StandaloneWallet, {})

  // Register the dual-signature protocol with WDK
  wdk.registerProtocol('standalone', 'dual', DualSignatureProtocol, {
    ecdsaEnabled: true,
    mldsaEnabled: true,
    defaultSignatureType: 'dual',
    mldsaAlgorithm: 'ML-DSA-65'
  })

  // Get account
  const account = await wdk.getAccount('standalone', 0)

  // Get the dual-signature protocol
  const dualSig = account.getDualSignatureProtocol('dual')

  // Initialize the protocol
  await dualSig.initialize()

  // Get and display addresses
  console.log('=== GENERATED ADDRESSES ===\n')
  const addresses = await dualSig.getAddresses()

  console.log('🏠 Ethereum Address (ECDSA):')
  console.log(`   ${addresses.ethereum}`)
  console.log(`   Checksum: ${addresses.ethereumChecksum}`)
  console.log()

  console.log('🔐 ML-DSA Address (Quantum-Resistant):')
  console.log(`   ${addresses.mldsa}`)
  if (addresses.mldsaFormats) {
    console.log(`   Truncated: ${addresses.mldsaFormats.truncated}`)
  }
  console.log()

  // Get public keys
  console.log('=== PUBLIC KEYS ===\n')
  const publicKeys = await dualSig.getPublicKeys()

  console.log('📍 ECDSA Public Key:')
  console.log(`   Compressed: ${publicKeys.ecdsa.compressed.substring(0, 20)}...`)
  console.log(`   Curve: secp256k1`)
  console.log()

  console.log('📍 ML-DSA Public Key:')
  console.log(`   Size: ${publicKeys.mldsa.size} bytes`)
  console.log(`   Algorithm: ${publicKeys.mldsa.algorithm}`)
  console.log(`   Security Level: ${publicKeys.mldsa.securityLevel || 3}`)
  console.log()

  // Demonstrate signing
  console.log('=== SIGNATURE DEMONSTRATION ===\n')

  const message = 'Hello, quantum-resistant world!'
  console.log(`📝 Message: "${message}"\n`)

  // Sign with ECDSA
  console.log('1️⃣  ECDSA Signature (Ethereum-compatible):')
  const startEcdsa = performance.now()
  const ecdsaSignature = await dualSig.signWithECDSA(message)
  const ecdsaTime = performance.now() - startEcdsa

  console.log(`   R: ${ecdsaSignature.r.substring(0, 20)}...`)
  console.log(`   S: ${ecdsaSignature.s.substring(0, 20)}...`)
  console.log(`   V: ${ecdsaSignature.v}`)
  console.log(`   Time: ${ecdsaTime.toFixed(2)}ms`)
  console.log()

  // Sign with ML-DSA
  console.log('2️⃣  ML-DSA Signature (Quantum-resistant):')
  const startMldsa = performance.now()
  const mldsaSignature = await dualSig.signWithMLDSA(message)
  const mldsaTime = performance.now() - startMldsa

  console.log(`   Algorithm: ${mldsaSignature.algorithm}`)
  console.log(`   Security Level: ${mldsaSignature.securityLevel}`)
  console.log(`   Signature Size: ${mldsaSignature.signature.length} bytes`)
  console.log(`   Time: ${mldsaTime.toFixed(2)}ms`)

  if (mldsaSignature.__placeholder) {
    console.log(`   ⚠️  Status: Placeholder (install @noble/post-quantum for real ML-DSA)`)
  } else {
    console.log(`   ✅ Status: Real ML-DSA implementation`)
  }
  console.log()

  // Dual signature
  console.log('3️⃣  Dual Signature (Both at once):')
  const startDual = performance.now()
  const dualSignature = await dualSig.dualSign(message)
  const dualTime = performance.now() - startDual

  console.log(`   Has ECDSA: ${dualSignature.ecdsa !== null}`)
  console.log(`   Has ML-DSA: ${dualSignature.mldsa !== null}`)
  console.log(`   Time: ${dualTime.toFixed(2)}ms`)
  console.log(`   Timestamp: ${new Date(dualSignature.timestamp).toISOString()}`)
  console.log()

  // Transaction example
  console.log('=== TRANSACTION EXAMPLE ===\n')

  const transaction = {
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    value: '1000000000000000000', // 1 ETH
    gasPrice: '20000000000',
    gasLimit: 21000,
    nonce: 0
  }

  console.log('💰 Transaction Details:')
  console.log(`   To: ${transaction.to}`)
  console.log(`   Value: 1 ETH`)
  console.log(`   Gas Price: 20 Gwei`)
  console.log()

  console.log('🔐 Signing transaction with both algorithms...')
  const txDualSig = await dualSig.dualSign(transaction)

  console.log('   ✓ ECDSA signature for Ethereum')
  console.log('   ✓ ML-DSA signature for verification network')
  console.log()

  // Performance comparison
  console.log('=== PERFORMANCE COMPARISON ===\n')

  const speedRatio = (mldsaTime / ecdsaTime).toFixed(1)
  const sizeRatio = (mldsaSignature.signature.length / (ecdsaSignature.signature.length / 2)).toFixed(1)

  console.log('⚡ Speed:')
  console.log(`   ECDSA: ${ecdsaTime.toFixed(2)}ms`)
  console.log(`   ML-DSA: ${mldsaTime.toFixed(2)}ms`)
  console.log(`   ML-DSA is ${speedRatio}x slower`)
  console.log()

  console.log('📏 Size:')
  console.log(`   ECDSA: ${ecdsaSignature.signature.length / 2} bytes`)
  console.log(`   ML-DSA: ${mldsaSignature.signature.length} bytes`)
  console.log(`   ML-DSA is ${sizeRatio}x larger`)
  console.log()

  // Protocol info
  console.log('=== PROTOCOL INFORMATION ===\n')

  const info = await dualSig.getInfo()
  console.log(`Protocol: ${info.protocol} v${info.version}`)
  console.log(`Configuration:`)
  console.log(`   ECDSA Enabled: ${info.config.ecdsaEnabled}`)
  console.log(`   ML-DSA Enabled: ${info.config.mldsaEnabled}`)
  console.log(`   Default Signature: ${info.config.defaultSignatureType}`)
  console.log(`   ML-DSA Algorithm: ${info.config.mldsaAlgorithm}`)
  console.log()

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║                         SUMMARY                             ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log('✅ Successfully Demonstrated:')
  console.log('   • Key derivation from single seed')
  console.log('   • ECDSA signatures for Ethereum')
  console.log('   • ML-DSA signatures for quantum resistance')
  console.log('   • Dual signature creation')
  console.log('   • Performance characteristics')
  console.log()

  console.log('🎯 Use Cases:')
  console.log('   • On-chain: Use ECDSA for Ethereum transactions')
  console.log('   • Off-chain: Use ML-DSA for verification networks')
  console.log('   • Hybrid: Sign once, get both signatures')
  console.log()

  // Check implementation status
  const hasRealMLDSA = !mldsaSignature.__placeholder
  if (hasRealMLDSA) {
    console.log('🔐 Quantum Security Status: ACTIVE')
    console.log('   Using real ML-DSA implementation from @noble/post-quantum')
  } else {
    console.log('⚠️  Quantum Security Status: PLACEHOLDER')
    console.log('   Install @noble/post-quantum for real quantum resistance')
  }
  console.log()

  // Cleanup
  dualSig.dispose()
  wdk.dispose()

  console.log('🧹 Cleaned up sensitive data')
}

// Run the example
main().catch(error => {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})