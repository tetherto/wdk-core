import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'

// Check the API
console.log('ML-DSA-65 API:')
console.log('  keygen signature:', ml_dsa65.keygen.toString().match(/\(.*?\)/)[0])
console.log('  sign signature:', ml_dsa65.sign.toString().match(/\(.*?\)/)[0])
console.log('  verify signature:', ml_dsa65.verify.toString().match(/\(.*?\)/)[0])
console.log('  lengths:', ml_dsa65.lengths)

// Test key generation and signing
const seed = new Uint8Array(32).fill(1)
const keyPair = ml_dsa65.keygen(seed)

console.log('\nKey sizes:')
console.log('  Secret key:', keyPair.secretKey.length)
console.log('  Public key:', keyPair.publicKey.length)

const message = new Uint8Array([1, 2, 3, 4, 5])

// Try different signing APIs
try {
  // API 1: sign(secretKey, message)
  const sig1 = ml_dsa65.sign(keyPair.secretKey, message)
  console.log('\nSignature API 1 works: sign(secretKey, message)')
  console.log('  Signature size:', sig1.length)
} catch (e) {
  console.log('\nAPI 1 failed:', e.message)
}

try {
  // API 2: sign(secretKey, message, context)
  const sig2 = ml_dsa65.sign(keyPair.secretKey, message, new Uint8Array())
  console.log('\nSignature API 2 works: sign(secretKey, message, context)')
  console.log('  Signature size:', sig2.length)
} catch (e) {
  console.log('\nAPI 2 failed:', e.message)
}

try {
  // API 3: sign(secretKey, message, opts)
  const sig3 = ml_dsa65.sign(keyPair.secretKey, message, {})
  console.log('\nSignature API 3 works: sign(secretKey, message, opts)')
  console.log('  Signature size:', sig3.length)
} catch (e) {
  console.log('\nAPI 3 failed:', e.message)
}

// Test verification
const signature = ml_dsa65.sign(keyPair.secretKey, message)
const isValid = ml_dsa65.verify(keyPair.publicKey, message, signature)
console.log('\nVerification works:', isValid)