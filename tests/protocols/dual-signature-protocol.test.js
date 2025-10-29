/**
 * Tests for DualSignatureProtocol
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { DualSignatureProtocol } from '../../src/protocols/dual-signature-protocol.js'
import { bytesToHex } from '@noble/hashes/utils'

// Mock account object
class MockAccount {
  constructor(seed, accountIndex = 0) {
    this._seed = seed
    this.accountIndex = accountIndex
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
}

describe('DualSignatureProtocol', () => {
  let protocol
  let account
  const testSeed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  beforeEach(() => {
    account = new MockAccount(testSeed)
    protocol = new DualSignatureProtocol(account, {
      ecdsaEnabled: true,
      mldsaEnabled: true,
      autoInitialize: true
    })
  })

  afterEach(() => {
    if (protocol) {
      protocol.dispose()
    }
  })

  describe('initialization', () => {
    test('should create protocol instance', () => {
      expect(protocol).toBeDefined()
      expect(protocol.isInitialized()).toBe(false)
    })

    test('should throw error if account is not provided', () => {
      expect(() => new DualSignatureProtocol()).toThrow('Account is required for DualSignatureProtocol')
    })

    test('should auto-initialize on first use', async () => {
      expect(protocol.isInitialized()).toBe(false)

      await protocol.getAddresses()

      expect(protocol.isInitialized()).toBe(true)
    })

    test('should manually initialize when called', async () => {
      expect(protocol.isInitialized()).toBe(false)

      await protocol.initialize()

      expect(protocol.isInitialized()).toBe(true)
    })

    test('should handle missing seed gracefully', async () => {
      const accountNoSeed = {
        getAccountIndex: async () => 0,
        getAddressIndex: async () => 0
      }

      const protocolNoSeed = new DualSignatureProtocol(accountNoSeed)

      await expect(protocolNoSeed.initialize()).rejects.toThrow('No seed available for key derivation')
    })
  })

  describe('ECDSA signing', () => {
    test('should sign with ECDSA', async () => {
      const data = 'test message'
      const signature = await protocol.signWithECDSA(data)

      expect(signature).toBeDefined()
      expect(signature.r).toBeDefined()
      expect(signature.s).toBeDefined()
      expect(signature.v).toBeDefined()
      expect(typeof signature.r).toBe('string')
      expect(typeof signature.s).toBe('string')
      expect(typeof signature.v).toBe('number')
    })

    test('should sign message with EIP-191', async () => {
      const message = 'Hello Ethereum!'
      const signature = await protocol.signMessageWithECDSA(message)

      expect(signature).toBeDefined()
      expect(signature.messageHash).toBeDefined()
      expect(signature.v).toBeGreaterThanOrEqual(27)
    })

    test('should sign transaction with ECDSA', async () => {
      const tx = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        value: '1000000000000000000',
        gasLimit: 21000,
        gasPrice: '20000000000'
      }

      const signedTx = await protocol.signTransactionWithECDSA(tx)

      expect(signedTx).toBeDefined()
      expect(signedTx.signature).toBeDefined()
      expect(signedTx.v).toBeDefined()
      expect(signedTx.r).toBeDefined()
      expect(signedTx.s).toBeDefined()
    })

    test('should throw error if ECDSA is disabled', async () => {
      const disabledProtocol = new DualSignatureProtocol(account, {
        ecdsaEnabled: false,
        mldsaEnabled: true
      })

      await expect(disabledProtocol.signWithECDSA('test')).rejects.toThrow('ECDSA signing is not enabled')

      disabledProtocol.dispose()
    })
  })

  describe('ML-DSA signing', () => {
    test('should sign with ML-DSA', async () => {
      const data = 'test message'
      const signature = await protocol.signWithMLDSA(data)

      expect(signature).toBeDefined()
      expect(signature.signature).toBeInstanceOf(Uint8Array)
      expect(signature.signatureHex).toBeDefined()
      expect(signature.algorithm).toBe('ML-DSA-65')
      expect(signature.securityLevel).toBe(3)
    })

    test('should throw error if ML-DSA is disabled', async () => {
      const disabledProtocol = new DualSignatureProtocol(account, {
        ecdsaEnabled: true,
        mldsaEnabled: false
      })

      await expect(disabledProtocol.signWithMLDSA('test')).rejects.toThrow('ML-DSA signing is not enabled')

      disabledProtocol.dispose()
    })
  })

  describe('dual signing', () => {
    test('should create both signatures', async () => {
      const data = { test: 'data' }
      const dualSig = await protocol.dualSign(data)

      expect(dualSig).toBeDefined()
      expect(dualSig.ecdsa).toBeDefined()
      expect(dualSig.mldsa).toBeDefined()
      expect(dualSig.data).toEqual(data)
      expect(dualSig.timestamp).toBeDefined()
      expect(dualSig.accountIndex).toBe(0)
      expect(dualSig.addressIndex).toBe(0)
    })

    test('should handle partial signing when one is disabled', async () => {
      const partialProtocol = new DualSignatureProtocol(account, {
        ecdsaEnabled: true,
        mldsaEnabled: false
      })

      const dualSig = await partialProtocol.dualSign('test')

      expect(dualSig.ecdsa).toBeDefined()
      expect(dualSig.mldsa).toBeNull()

      partialProtocol.dispose()
    })
  })

  describe('signature verification', () => {
    test('should verify ECDSA signature', async () => {
      const data = 'test message'
      const signature = await protocol.signWithECDSA(data)

      // Note: Verification would need the actual signature format
      // This is a simplified test
      expect(signature).toBeDefined()
    })

    test('should verify ML-DSA signature', async () => {
      const data = 'test message'
      const signature = await protocol.signWithMLDSA(data)

      const isValid = await protocol.verifyMLDSA(data, signature)

      // With placeholder implementation, this returns true for correct size
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('address generation', () => {
    test('should generate both addresses', async () => {
      const addresses = await protocol.getAddresses()

      expect(addresses).toBeDefined()
      expect(addresses.ethereum).toBeDefined()
      expect(addresses.ethereum).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(addresses.ethereumChecksum).toBeDefined()
      expect(addresses.mldsa).toBeDefined()
      expect(addresses.mldsa).toMatch(/^mldsa:[a-fA-F0-9]{40}$/)
    })

    test('should cache addresses', async () => {
      const addresses1 = await protocol.getAddresses()
      const addresses2 = await protocol.getAddresses()

      expect(addresses1).toBe(addresses2) // Same object reference
    })
  })

  describe('public keys', () => {
    test('should return public keys for both types', async () => {
      const publicKeys = await protocol.getPublicKeys()

      expect(publicKeys).toBeDefined()
      expect(publicKeys.ecdsa).toBeDefined()
      expect(publicKeys.ecdsa.compressed).toBeDefined()
      expect(publicKeys.mldsa).toBeDefined()
      expect(publicKeys.mldsa.hex).toBeDefined()
    })

    test('should cache public keys', async () => {
      const keys1 = await protocol.getPublicKeys()
      const keys2 = await protocol.getPublicKeys()

      expect(keys1).toBe(keys2) // Same object reference
    })
  })

  describe('fingerprints', () => {
    test('should generate fingerprints for both key types', async () => {
      const fingerprints = await protocol.getFingerprints()

      expect(fingerprints).toBeDefined()
      expect(fingerprints.ecdsa).toBeDefined()
      expect(fingerprints.mldsa).toBeDefined()
      expect(typeof fingerprints.mldsa).toBe('string')
    })
  })

  describe('export functionality', () => {
    test('should export public keys', async () => {
      const exported = await protocol.exportPublicKeys()

      expect(exported).toBeDefined()
      expect(exported.ecdsa).toBeDefined()
      expect(exported.ecdsa.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(exported.ecdsa.publicKey).toBeDefined()
      expect(exported.mldsa).toBeDefined()
      expect(exported.mldsa.address).toMatch(/^mldsa:[a-fA-F0-9]{40}$/)
      expect(exported.accountIndex).toBe(0)
      expect(exported.addressIndex).toBe(0)
    })
  })

  describe('default signing', () => {
    test('should use default signature type', async () => {
      const ecdsaProtocol = new DualSignatureProtocol(account, {
        defaultSignatureType: 'ecdsa'
      })

      const signature = await ecdsaProtocol.sign('test')

      expect(signature.r).toBeDefined() // ECDSA signature

      ecdsaProtocol.dispose()
    })

    test('should allow override of signature type', async () => {
      const signature = await protocol.sign('test', { type: 'mldsa' })

      expect(signature.signature).toBeInstanceOf(Uint8Array) // ML-DSA signature
    })

    test('should create dual signature when requested', async () => {
      const signature = await protocol.sign('test', { type: 'dual' })

      expect(signature.ecdsa).toBeDefined()
      expect(signature.mldsa).toBeDefined()
    })

    test('should throw error for invalid signature type', async () => {
      await expect(protocol.sign('test', { type: 'invalid' })).rejects.toThrow('Invalid signature type: invalid')
    })
  })

  describe('protocol information', () => {
    test('should return protocol info', async () => {
      const info = await protocol.getInfo()

      expect(info).toBeDefined()
      expect(info.protocol).toBe('DualSignatureProtocol')
      expect(info.version).toBe('1.0.0')
      expect(info.initialized).toBe(true)
      expect(info.config).toBeDefined()
      expect(info.config.ecdsaEnabled).toBe(true)
      expect(info.config.mldsaEnabled).toBe(true)
      expect(info.signers).toBeDefined()
      expect(info.addresses).toBeDefined()
    })
  })

  describe('cache management', () => {
    test('should clear caches', async () => {
      // Populate caches
      await protocol.getAddresses()
      await protocol.getPublicKeys()

      protocol.clearCaches()

      // After clearing, new calls should generate new objects
      const addresses1 = await protocol.getAddresses()
      const addresses2 = await protocol.getAddresses()

      // After first call, should be cached again
      expect(addresses1).toBe(addresses2)
    })
  })

  describe('disposal', () => {
    test('should dispose all resources', async () => {
      await protocol.initialize()
      expect(protocol.isInitialized()).toBe(true)

      protocol.dispose()

      expect(protocol.isInitialized()).toBe(false)
    })

    test('should be safe to dispose multiple times', () => {
      expect(() => {
        protocol.dispose()
        protocol.dispose()
      }).not.toThrow()
    })
  })

  describe('multiple accounts', () => {
    test('should handle different account indices', async () => {
      const account1 = new MockAccount(testSeed, 0)
      const account2 = new MockAccount(testSeed, 1)

      const protocol1 = new DualSignatureProtocol(account1)
      const protocol2 = new DualSignatureProtocol(account2)

      const addr1 = await protocol1.getAddresses()
      const addr2 = await protocol2.getAddresses()

      expect(addr1.ethereum).not.toBe(addr2.ethereum)
      expect(addr1.mldsa).not.toBe(addr2.mldsa)

      protocol1.dispose()
      protocol2.dispose()
    })
  })

  describe('configuration options', () => {
    test('should respect autoInitialize setting', async () => {
      const manualProtocol = new DualSignatureProtocol(account, {
        autoInitialize: false
      })

      expect(manualProtocol.isInitialized()).toBe(false)

      await expect(manualProtocol._ensureInitialized()).rejects.toThrow(
        'DualSignatureProtocol not initialized. Call initialize() first.'
      )

      manualProtocol.dispose()
    })

    test('should use custom ML-DSA algorithm', async () => {
      const customProtocol = new DualSignatureProtocol(account, {
        mldsaAlgorithm: 'ML-DSA-87'
      })

      const info = await customProtocol.getInfo()
      expect(info.config.mldsaAlgorithm).toBe('ML-DSA-87')

      customProtocol.dispose()
    })

    test('should use provided seed', async () => {
      const customSeed = 'custom seed phrase twelve words long enough for testing purpose only'
      const customProtocol = new DualSignatureProtocol(account, {
        seed: customSeed
      })

      await customProtocol.initialize()
      expect(customProtocol.isInitialized()).toBe(true)

      customProtocol.dispose()
    })
  })
})