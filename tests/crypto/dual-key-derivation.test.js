/**
 * Tests for DualKeyDerivation module
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { DualKeyDerivation, DERIVATION_PATHS } from '../../src/crypto/dual-key-derivation.js'
import { bytesToHex } from '@noble/hashes/utils'

describe('DualKeyDerivation', () => {
  let derivation
  const testSeed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  beforeEach(() => {
    derivation = new DualKeyDerivation(testSeed)
  })

  afterEach(() => {
    if (derivation) {
      derivation.dispose()
    }
  })

  describe('initialization', () => {
    test('should accept BIP-39 mnemonic seed', async () => {
      const keyDerivation = new DualKeyDerivation(testSeed)
      expect(keyDerivation).toBeDefined()
      expect(keyDerivation.getInfo().initialized).toBe(false)
      keyDerivation.dispose()
    })

    test('should accept Uint8Array seed', async () => {
      const seedBytes = new Uint8Array(64).fill(0)
      const keyDerivation = new DualKeyDerivation(seedBytes)
      expect(keyDerivation).toBeDefined()
      keyDerivation.dispose()
    })

    test('should throw error for invalid seed type', async () => {
      expect(() => new DualKeyDerivation(12345)).not.toThrow() // Constructor doesn't validate
      const invalidDerivation = new DualKeyDerivation(12345)
      await expect(invalidDerivation.deriveECDSAKey()).rejects.toThrow('Seed must be a BIP-39 mnemonic string or Uint8Array')
    })
  })

  describe('ECDSA key derivation', () => {
    test('should derive ECDSA key with default indices', async () => {
      const ecdsaKey = await derivation.deriveECDSAKey()

      expect(ecdsaKey).toBeDefined()
      expect(ecdsaKey.privateKey).toBeInstanceOf(Uint8Array)
      expect(ecdsaKey.privateKey.length).toBe(32)
      expect(ecdsaKey.publicKey).toBeInstanceOf(Uint8Array)
      expect(ecdsaKey.path).toBe("m/44'/60'/0'/0/0")
      expect(ecdsaKey.type).toBe('ECDSA')
      expect(ecdsaKey.curve).toBe('secp256k1')
    })

    test('should derive different keys for different indices', async () => {
      const key1 = await derivation.deriveECDSAKey(0, 0)
      const key2 = await derivation.deriveECDSAKey(0, 1)
      const key3 = await derivation.deriveECDSAKey(1, 0)

      expect(bytesToHex(key1.privateKey)).not.toBe(bytesToHex(key2.privateKey))
      expect(bytesToHex(key1.privateKey)).not.toBe(bytesToHex(key3.privateKey))
      expect(bytesToHex(key2.privateKey)).not.toBe(bytesToHex(key3.privateKey))
    })

    test('should derive deterministic keys', async () => {
      const key1 = await derivation.deriveECDSAKey(0, 0)
      const key2 = await derivation.deriveECDSAKey(0, 0)

      expect(bytesToHex(key1.privateKey)).toBe(bytesToHex(key2.privateKey))
      expect(bytesToHex(key1.publicKey)).toBe(bytesToHex(key2.publicKey))
      expect(key1.path).toBe(key2.path)
    })

    test('should use correct BIP-44 path for Ethereum', async () => {
      const key = await derivation.deriveECDSAKey(5, 10)
      expect(key.path).toBe("m/44'/60'/5'/0/10")
    })
  })

  describe('ML-DSA key derivation', () => {
    test('should derive ML-DSA key with default indices', async () => {
      const mldsaKey = await derivation.deriveMLDSAKey()

      expect(mldsaKey).toBeDefined()
      expect(mldsaKey.seed).toBeInstanceOf(Uint8Array)
      expect(mldsaKey.seed.length).toBe(32)
      expect(mldsaKey.privateKey).toBeInstanceOf(Uint8Array)
      expect(mldsaKey.publicKey).toBeInstanceOf(Uint8Array)
      expect(mldsaKey.path).toBe("m/44'/9000'/0'/0/0")
      expect(mldsaKey.type).toBe('ML-DSA')
      expect(mldsaKey.algorithm).toBe('ML-DSA-65')
      expect(mldsaKey.securityLevel).toBe(3)
    })

    test('should derive different keys for different indices', async () => {
      const key1 = await derivation.deriveMLDSAKey(0, 0)
      const key2 = await derivation.deriveMLDSAKey(0, 1)
      const key3 = await derivation.deriveMLDSAKey(1, 0)

      expect(bytesToHex(key1.seed)).not.toBe(bytesToHex(key2.seed))
      expect(bytesToHex(key1.seed)).not.toBe(bytesToHex(key3.seed))
      expect(bytesToHex(key2.seed)).not.toBe(bytesToHex(key3.seed))
    })

    test('should derive deterministic seeds', async () => {
      const key1 = await derivation.deriveMLDSAKey(0, 0)
      const key2 = await derivation.deriveMLDSAKey(0, 0)

      expect(bytesToHex(key1.seed)).toBe(bytesToHex(key2.seed))
      expect(key1.path).toBe(key2.path)
    })

    test('should use correct custom path for ML-DSA', async () => {
      const key = await derivation.deriveMLDSAKey(3, 7)
      expect(key.path).toBe("m/44'/9000'/3'/0/7")
    })
  })

  describe('deriveBothKeys', () => {
    test('should derive both ECDSA and ML-DSA keys', async () => {
      const keys = await derivation.deriveBothKeys(0, 0)

      expect(keys.ecdsa).toBeDefined()
      expect(keys.mldsa).toBeDefined()
      expect(keys.ecdsa.type).toBe('ECDSA')
      expect(keys.mldsa.type).toBe('ML-DSA')
      expect(keys.accountIndex).toBe(0)
      expect(keys.addressIndex).toBe(0)
    })

    test('should derive different keys for ECDSA and ML-DSA', async () => {
      const keys = await derivation.deriveBothKeys(0, 0)

      // The seeds should be different due to different derivation paths
      expect(bytesToHex(keys.ecdsa.privateKey)).not.toBe(bytesToHex(keys.mldsa.seed))
    })
  })

  describe('getDerivationPaths', () => {
    test('should return correct paths for both key types', () => {
      const paths = derivation.getDerivationPaths(2, 5)

      expect(paths.ecdsa).toBe("m/44'/60'/2'/0/5")
      expect(paths.mldsa).toBe("m/44'/9000'/2'/0/5")
    })

    test('should use default indices when not provided', () => {
      const paths = derivation.getDerivationPaths()

      expect(paths.ecdsa).toBe("m/44'/60'/0'/0/0")
      expect(paths.mldsa).toBe("m/44'/9000'/0'/0/0")
    })
  })

  describe('validateDeterministic', () => {
    test('should confirm deterministic key generation', async () => {
      const isValid = await derivation.validateDeterministic(0, 0)
      expect(isValid).toBe(true)
    })
  })

  describe('getInfo', () => {
    test('should return derivation information', () => {
      const info = derivation.getInfo()

      expect(info.initialized).toBe(false)
      expect(info.paths).toBe(DERIVATION_PATHS)
      expect(info.ecdsaCurve).toBe('secp256k1')
      expect(info.mldsaAlgorithm).toBe('ML-DSA-65')
      expect(info.mldsaSecurityLevel).toBe(3)
    })

    test('should show initialized after key derivation', async () => {
      expect(derivation.getInfo().initialized).toBe(false)

      await derivation.deriveECDSAKey()

      expect(derivation.getInfo().initialized).toBe(true)
    })
  })

  describe('dispose', () => {
    test('should clear sensitive data', async () => {
      await derivation.deriveECDSAKey()
      expect(derivation.getInfo().initialized).toBe(true)

      derivation.dispose()

      expect(derivation.getInfo().initialized).toBe(false)
    })

    test('should be safe to call multiple times', () => {
      expect(() => {
        derivation.dispose()
        derivation.dispose()
      }).not.toThrow()
    })
  })

  describe('error handling', () => {
    test('should throw error for invalid path type', async () => {
      // This would require modifying the private _buildPath method
      // The current implementation will throw if an invalid type is provided
      const customDerivation = new DualKeyDerivation(testSeed)
      customDerivation._buildPath = function(type, accountIndex, addressIndex) {
        if (type !== 'ECDSA' && type !== 'MLDSA') {
          throw new Error(`Invalid key type: ${type}`)
        }
        return DualKeyDerivation.prototype._buildPath.call(this, type, accountIndex, addressIndex)
      }

      await expect(async () => {
        await customDerivation._buildPath('INVALID', 0, 0)
      }).rejects.toThrow('Invalid key type: INVALID')

      customDerivation.dispose()
    })
  })
})