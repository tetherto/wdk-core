#!/usr/bin/env node

/**
 * Benchmark ML-DSA vs ECDSA performance
 */

import { DualKeyDerivation } from './src/crypto/dual-key-derivation.js'
import { ECDSASigner } from './src/crypto/ecdsa-signer.js'
import { MLDSASigner } from './src/crypto/mldsa-signer.js'

console.log('=== PERFORMANCE BENCHMARK: ECDSA vs ML-DSA ===\n')

const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const message = new Uint8Array(32).fill(42) // 32-byte message
const iterations = 10

async function benchmark() {
  const derivation = new DualKeyDerivation(seed)

  // Key generation benchmarks
  console.log('Key Generation:')

  let start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await derivation.deriveECDSAKey(0, i)
  }
  let ecdsaKeyTime = (performance.now() - start) / iterations

  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await derivation.deriveMLDSAKey(0, i)
  }
  let mldsaKeyTime = (performance.now() - start) / iterations

  console.log(`  ECDSA: ${ecdsaKeyTime.toFixed(2)}ms per key`)
  console.log(`  ML-DSA: ${mldsaKeyTime.toFixed(2)}ms per key`)
  console.log(`  ML-DSA is ${(mldsaKeyTime / ecdsaKeyTime).toFixed(1)}x slower\n`)

  // Setup for signing benchmarks
  const ecdsaKey = await derivation.deriveECDSAKey(0, 0)
  const mldsaKey = await derivation.deriveMLDSAKey(0, 0)
  const ecdsaSigner = new ECDSASigner(ecdsaKey)
  const mldsaSigner = new MLDSASigner(mldsaKey)

  // Signing benchmarks
  console.log('Signing:')

  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await ecdsaSigner.sign(message)
  }
  let ecdsaSignTime = (performance.now() - start) / iterations

  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await mldsaSigner.sign(message)
  }
  let mldsaSignTime = (performance.now() - start) / iterations

  console.log(`  ECDSA: ${ecdsaSignTime.toFixed(2)}ms per signature`)
  console.log(`  ML-DSA: ${mldsaSignTime.toFixed(2)}ms per signature`)
  console.log(`  ML-DSA is ${(mldsaSignTime / ecdsaSignTime).toFixed(1)}x slower\n`)

  // Get signature sizes
  const ecdsaSig = await ecdsaSigner.sign(message)
  const mldsaSig = await mldsaSigner.sign(message)

  // Verification benchmarks
  console.log('Verification:')

  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    ecdsaSigner.verify(message, ecdsaSig)
  }
  let ecdsaVerifyTime = (performance.now() - start) / iterations

  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await mldsaSigner.verify(message, mldsaSig)
  }
  let mldsaVerifyTime = (performance.now() - start) / iterations

  console.log(`  ECDSA: ${ecdsaVerifyTime.toFixed(2)}ms per verification`)
  console.log(`  ML-DSA: ${mldsaVerifyTime.toFixed(2)}ms per verification`)
  console.log(`  ML-DSA is ${(mldsaVerifyTime / ecdsaVerifyTime).toFixed(1)}x slower\n`)

  // Size comparison
  console.log('Sizes:')
  console.log(`  ECDSA signature: ${ecdsaSig.signature.length / 2} bytes`)
  console.log(`  ML-DSA signature: ${mldsaSig.signature.length} bytes`)
  console.log(`  ML-DSA is ${(mldsaSig.signature.length / (ecdsaSig.signature.length / 2)).toFixed(1)}x larger\n`)

  console.log('Key Sizes:')
  console.log(`  ECDSA private key: ${ecdsaKey.privateKey.length} bytes`)
  console.log(`  ECDSA public key: ${ecdsaKey.publicKey.length} bytes`)
  console.log(`  ML-DSA private key: ${mldsaKey.privateKey.length} bytes`)
  console.log(`  ML-DSA public key: ${mldsaKey.publicKey.length} bytes\n`)

  // Summary
  console.log('=== SUMMARY ===')
  console.log(`ML-DSA provides quantum resistance but is:`)
  console.log(`  • ${(mldsaKeyTime / ecdsaKeyTime).toFixed(1)}x slower for key generation`)
  console.log(`  • ${(mldsaSignTime / ecdsaSignTime).toFixed(1)}x slower for signing`)
  console.log(`  • ${(mldsaVerifyTime / ecdsaVerifyTime).toFixed(1)}x slower for verification`)
  console.log(`  • ${(mldsaSig.signature.length / (ecdsaSig.signature.length / 2)).toFixed(1)}x larger signatures`)

  // Check if we're using real ML-DSA
  if (!mldsaKey.__placeholder) {
    console.log('\n✅ Using REAL ML-DSA implementation (quantum-resistant)')
  } else {
    console.log('\n⚠️  Using placeholder ML-DSA (NOT quantum-resistant)')
  }

  // Cleanup
  ecdsaSigner.dispose()
  mldsaSigner.dispose()
  derivation.dispose()
}

benchmark().catch(console.error)