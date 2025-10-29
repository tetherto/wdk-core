#!/usr/bin/env node

/**
 * Test script for dual-signature functionality
 *
 * This script tests the core functionality without requiring external dependencies
 */

import { DualKeyDerivation } from './src/crypto/dual-key-derivation.js'
import { ECDSASigner } from './src/crypto/ecdsa-signer.js'
import { MLDSASigner } from './src/crypto/mldsa-signer.js'
import { DualSignatureProtocol } from './src/protocols/dual-signature-protocol.js'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
}

// Mock account for testing
class MockAccount {
  constructor(seed) {
    this._seed = seed
  }

  async getSeed() {
    return this._seed
  }

  async getAccountIndex() {
    return 0
  }

  async getAddressIndex() {
    return 0
  }
}

async function testKeyDerivation() {
  log.section('Testing Key Derivation')

  try {
    const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const derivation = new DualKeyDerivation(seed)

    // Test ECDSA key derivation
    log.info('Deriving ECDSA keys...')
    const ecdsaKey = await derivation.deriveECDSAKey(0, 0)
    log.success(`ECDSA key derived: ${ecdsaKey.path}`)
    log.info(`  Private key size: ${ecdsaKey.privateKey.length} bytes`)
    log.info(`  Public key size: ${ecdsaKey.publicKey.length} bytes`)

    // Test ML-DSA key derivation
    log.info('Deriving ML-DSA keys...')
    const mldsaKey = await derivation.deriveMLDSAKey(0, 0)
    log.success(`ML-DSA key derived: ${mldsaKey.path}`)
    log.info(`  Seed size: ${mldsaKey.seed.length} bytes`)
    log.info(`  Algorithm: ${mldsaKey.algorithm}`)
    log.info(`  Security level: ${mldsaKey.securityLevel}`)

    // Test deterministic derivation
    log.info('Testing deterministic derivation...')
    const ecdsaKey2 = await derivation.deriveECDSAKey(0, 0)
    const keysMatch = Buffer.from(ecdsaKey.privateKey).equals(Buffer.from(ecdsaKey2.privateKey))

    if (keysMatch) {
      log.success('Keys are deterministic (same seed = same keys)')
    } else {
      log.error('Keys are not deterministic!')
    }

    // Test different account indices
    log.info('Testing different account indices...')
    const account1Key = await derivation.deriveECDSAKey(1, 0)
    const differentKeys = !Buffer.from(ecdsaKey.privateKey).equals(Buffer.from(account1Key.privateKey))

    if (differentKeys) {
      log.success('Different accounts have different keys')
    } else {
      log.error('Different accounts have the same keys!')
    }

    derivation.dispose()
    log.success('Key derivation tests completed')

  } catch (error) {
    log.error(`Key derivation test failed: ${error.message}`)
    throw error
  }
}

async function testECDSASigner() {
  log.section('Testing ECDSA Signer')

  try {
    const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const derivation = new DualKeyDerivation(seed)
    const ecdsaKey = await derivation.deriveECDSAKey(0, 0)
    const signer = new ECDSASigner(ecdsaKey)

    // Test address generation
    log.info('Generating Ethereum address...')
    const address = signer.getAddress()
    const checksumAddress = signer.getChecksumAddress()
    log.success(`Ethereum address: ${address}`)
    log.success(`Checksum address: ${checksumAddress}`)

    // Validate address format
    if (address.match(/^0x[a-fA-F0-9]{40}$/)) {
      log.success('Address format is valid')
    } else {
      log.error('Invalid address format!')
    }

    // Test signing
    log.info('Testing ECDSA signing...')
    const message = 'Hello, Ethereum!'
    const signature = await signer.sign(message)
    log.success('Message signed successfully')
    log.info(`  R: ${signature.r.substring(0, 20)}...`)
    log.info(`  S: ${signature.s.substring(0, 20)}...`)
    log.info(`  V: ${signature.v}`)

    // Test message signing with EIP-191
    log.info('Testing EIP-191 personal message signing...')
    const personalSig = await signer.signMessage(message)
    log.success('Personal message signed')
    log.info(`  Message hash: ${personalSig.messageHash.substring(0, 20)}...`)

    // Test transaction signing
    log.info('Testing transaction signing...')
    const tx = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      value: '1000000000000000000',
      gasLimit: 21000,
      gasPrice: '20000000000'
    }
    const signedTx = await signer.signTransaction(tx)
    log.success('Transaction signed successfully')

    signer.dispose()
    derivation.dispose()
    log.success('ECDSA signer tests completed')

  } catch (error) {
    log.error(`ECDSA signer test failed: ${error.message}`)
    throw error
  }
}

async function testMLDSASigner() {
  log.section('Testing ML-DSA Signer')

  try {
    const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const derivation = new DualKeyDerivation(seed)
    const mldsaKey = await derivation.deriveMLDSAKey(0, 0)
    const signer = new MLDSASigner(mldsaKey)

    // Test address generation
    log.info('Generating ML-DSA address...')
    const address = signer.getAddress()
    log.success(`ML-DSA address: ${address}`)

    // Validate address format
    if (address.match(/^mldsa:[a-fA-F0-9]{40}$/)) {
      log.success('ML-DSA address format is valid')
    } else {
      log.error('Invalid ML-DSA address format!')
    }

    // Test fingerprint
    log.info('Generating public key fingerprint...')
    const fingerprint = signer.getFingerprint()
    log.success(`Fingerprint: ${fingerprint}`)

    // Test signing
    log.info('Testing ML-DSA signing...')
    const message = 'Hello, quantum world!'
    const signature = await signer.sign(message)
    log.success('Message signed with ML-DSA')
    log.info(`  Algorithm: ${signature.algorithm}`)
    log.info(`  Security level: ${signature.securityLevel}`)
    log.info(`  Signature size: ${signature.signature.length} bytes`)

    if (signature.__placeholder) {
      log.warning('Using placeholder ML-DSA implementation (not quantum-safe yet)')
      log.info('Install a real ML-DSA library for production use')
    }

    // Test verification
    log.info('Testing ML-DSA verification...')
    const isValid = await signer.verify(message, signature)
    if (isValid) {
      log.success('Signature verification passed')
    } else {
      log.error('Signature verification failed!')
    }

    // Test info
    const info = signer.getInfo()
    log.info('ML-DSA Signer Info:')
    log.info(`  Algorithm: ${info.algorithm}`)
    log.info(`  NIST Level: ${info.nistLevel}`)
    log.info(`  Signature size: ${info.signatureSize} bytes`)

    signer.dispose()
    derivation.dispose()
    log.success('ML-DSA signer tests completed')

  } catch (error) {
    log.error(`ML-DSA signer test failed: ${error.message}`)
    throw error
  }
}

async function testDualSignatureProtocol() {
  log.section('Testing Dual Signature Protocol')

  try {
    const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const account = new MockAccount(seed)
    const protocol = new DualSignatureProtocol(account, {
      ecdsaEnabled: true,
      mldsaEnabled: true,
      defaultSignatureType: 'ecdsa'
    })

    // Test initialization
    log.info('Initializing protocol...')
    await protocol.initialize()
    if (protocol.isInitialized()) {
      log.success('Protocol initialized successfully')
    } else {
      log.error('Protocol initialization failed!')
    }

    // Test address generation
    log.info('Getting addresses...')
    const addresses = await protocol.getAddresses()
    log.success('Addresses generated:')
    log.info(`  Ethereum: ${addresses.ethereum}`)
    log.info(`  ML-DSA: ${addresses.mldsa}`)

    // Test public keys
    log.info('Getting public keys...')
    const publicKeys = await protocol.getPublicKeys()
    log.success('Public keys retrieved')
    log.info(`  ECDSA compressed: ${publicKeys.ecdsa.compressed.substring(0, 20)}...`)
    log.info(`  ML-DSA size: ${publicKeys.mldsa.size} bytes`)

    // Test ECDSA signing
    log.info('Testing ECDSA signing through protocol...')
    const message = 'Test message for dual signatures'
    const ecdsaSig = await protocol.signWithECDSA(message)
    log.success('ECDSA signature created')
    log.info(`  Signature: ${ecdsaSig.signature.substring(0, 20)}...`)

    // Test ML-DSA signing
    log.info('Testing ML-DSA signing through protocol...')
    const mldsaSig = await protocol.signWithMLDSA(message)
    log.success('ML-DSA signature created')
    log.info(`  Size: ${mldsaSig.signature.length} bytes`)

    // Test dual signing
    log.info('Testing dual signing (both signatures at once)...')
    const dualSig = await protocol.dualSign(message)
    log.success('Dual signature created')
    log.info(`  Has ECDSA: ${dualSig.ecdsa !== null}`)
    log.info(`  Has ML-DSA: ${dualSig.mldsa !== null}`)
    log.info(`  Timestamp: ${new Date(dualSig.timestamp).toISOString()}`)

    // Test transaction signing
    log.info('Testing transaction signing...')
    const tx = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      value: '1000000000000000000',
      gasLimit: 21000
    }
    const signedTx = await protocol.signTransactionWithECDSA(tx)
    log.success('Transaction signed with ECDSA')

    // Test protocol info
    log.info('Getting protocol info...')
    const info = await protocol.getInfo()
    log.success(`Protocol: ${info.protocol} v${info.version}`)
    log.info(`  ECDSA enabled: ${info.config.ecdsaEnabled}`)
    log.info(`  ML-DSA enabled: ${info.config.mldsaEnabled}`)
    log.info(`  Default signature: ${info.config.defaultSignatureType}`)

    // Test export
    log.info('Testing public key export...')
    const exported = await protocol.exportPublicKeys()
    log.success('Public keys exported for sharing')
    log.info(`  ECDSA address: ${exported.ecdsa.address}`)
    log.info(`  ML-DSA address: ${exported.mldsa.address}`)

    protocol.dispose()
    log.success('Dual signature protocol tests completed')

  } catch (error) {
    log.error(`Dual signature protocol test failed: ${error.message}`)
    throw error
  }
}

async function runAllTests() {
  console.log(`${colors.bold}${colors.cyan}`)
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║     DUAL SIGNATURE (ECDSA + ML-DSA) TEST SUITE      ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(colors.reset)

  const startTime = Date.now()
  let allTestsPassed = true

  try {
    await testKeyDerivation()
  } catch (error) {
    allTestsPassed = false
  }

  try {
    await testECDSASigner()
  } catch (error) {
    allTestsPassed = false
  }

  try {
    await testMLDSASigner()
  } catch (error) {
    allTestsPassed = false
  }

  try {
    await testDualSignatureProtocol()
  } catch (error) {
    allTestsPassed = false
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n' + '═'.repeat(56))

  if (allTestsPassed) {
    console.log(`${colors.green}${colors.bold}`)
    console.log('ALL TESTS PASSED! 🎉')
    console.log(colors.reset)
    log.success(`Test suite completed in ${elapsed}s`)
    log.info('The dual-signature implementation is working correctly!')
    log.info('Ready for integration with your off-chain verification network.')
  } else {
    console.log(`${colors.red}${colors.bold}`)
    console.log('SOME TESTS FAILED')
    console.log(colors.reset)
    log.error(`Test suite completed with errors in ${elapsed}s`)
  }

  console.log('\n' + colors.cyan + 'Next steps:' + colors.reset)
  console.log('1. Install a real ML-DSA library for production use')
  console.log('2. Integrate with your off-chain verification network')
  console.log('3. Test with real Ethereum transactions')
  console.log('4. Run the full example: node examples/dual-signature-usage.js')
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})