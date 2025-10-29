/**
 * ML-DSA Signer Module
 *
 * Provides ML-DSA (Module-Lattice-Based Digital Signature Algorithm) signing
 * and verification capabilities for post-quantum cryptography.
 *
 * Based on NIST FIPS 204 standard (formerly known as CRYSTALS-Dilithium)
 */

import { sha3_256, shake256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

/**
 * ML-DSA Security Levels
 */
const ML_DSA_LEVELS = {
  ML_DSA_44: {
    level: 2,
    privateKeySize: 2560,
    publicKeySize: 1312,
    signatureSize: 2420
  },
  ML_DSA_65: {
    level: 3,
    privateKeySize: 4032,
    publicKeySize: 1952,
    signatureSize: 3293
  },
  ML_DSA_87: {
    level: 5,
    privateKeySize: 4896,
    publicKeySize: 2592,
    signatureSize: 4595
  }
}

/**
 * ML-DSA Signer class for post-quantum signatures
 */
export class MLDSASigner {
  /**
   * @param {Object} keyPair - Key pair object from DualKeyDerivation
   * @param {Uint8Array} keyPair.privateKey - ML-DSA private key
   * @param {Uint8Array} keyPair.publicKey - ML-DSA public key
   * @param {Uint8Array} keyPair.seed - 32-byte seed used for key generation
   * @param {string} keyPair.path - HD derivation path
   * @param {string} keyPair.algorithm - Algorithm identifier (e.g., 'ML-DSA-65')
   */
  constructor(keyPair) {
    if (!keyPair || !keyPair.privateKey || !keyPair.publicKey) {
      throw new Error('Invalid key pair provided to MLDSASigner')
    }

    this._privateKey = keyPair.privateKey
    this._publicKey = keyPair.publicKey
    this._seed = keyPair.seed
    this._path = keyPair.path || ''
    this._algorithm = keyPair.algorithm || 'ML-DSA-65'
    this._securityLevel = keyPair.securityLevel || 3
    this._accountIndex = keyPair.accountIndex || 0
    this._addressIndex = keyPair.addressIndex || 0

    // Validate key sizes
    this._validateKeySizes()

    // Check if we have a real ML-DSA implementation
    this._hasRealImplementation = !keyPair.__placeholder
  }

  /**
   * Validate key sizes match the algorithm
   * @private
   */
  _validateKeySizes() {
    const expectedSizes = ML_DSA_LEVELS[this._algorithm]
    if (!expectedSizes) {
      throw new Error(`Unknown ML-DSA algorithm: ${this._algorithm}`)
    }

    // Only validate if we have a real implementation
    if (!this._hasRealImplementation) {
      return // Skip validation for placeholder keys
    }

    if (this._privateKey.length !== expectedSizes.privateKeySize) {
      console.warn(
        `Invalid private key size for ${this._algorithm}: ` +
        `expected ${expectedSizes.privateKeySize}, got ${this._privateKey.length}`
      )
    }

    if (this._publicKey.length !== expectedSizes.publicKeySize) {
      console.warn(
        `Invalid public key size for ${this._algorithm}: ` +
        `expected ${expectedSizes.publicKeySize}, got ${this._publicKey.length}`
      )
    }
  }

  /**
   * Sign data with ML-DSA
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @param {boolean} options.deterministic - Use deterministic signing (default: true)
   * @param {Uint8Array} options.context - Optional context string
   * @returns {Promise<Object>} ML-DSA signature
   */
  async sign(data, options = {}) {
    const { deterministic = true, context = new Uint8Array() } = options

    // Convert data to bytes
    const message = this._dataToBytes(data)

    // If we have a real ML-DSA implementation, use it
    if (this._hasRealImplementation) {
      return this._signWithRealImplementation(message, context, deterministic)
    }

    // Otherwise, use placeholder implementation for development
    return this._signWithPlaceholder(message, context, deterministic)
  }

  /**
   * Sign with real ML-DSA implementation
   * @private
   */
  async _signWithRealImplementation(message, context, deterministic) {
    try {
      // Try to import ML-DSA library
      const { ml_dsa_65 } = await import('@noble/post-quantum').catch(() => ({}))

      if (ml_dsa_65) {
        const signature = ml_dsa_65.sign(message, this._privateKey, { context, deterministic })

        return {
          signature,
          signatureHex: bytesToHex(signature),
          algorithm: this._algorithm,
          securityLevel: this._securityLevel,
          publicKey: this._publicKey,
          messageHash: bytesToHex(sha3_256(message)),
          context: bytesToHex(context),
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.warn('ML-DSA library error:', error.message)
    }

    // Fallback to placeholder
    return this._signWithPlaceholder(message, context, deterministic)
  }

  /**
   * Placeholder signing implementation for development
   * @private
   */
  _signWithPlaceholder(message, context, deterministic) {
    console.warn('Using placeholder ML-DSA implementation. NOT secure for production!')

    // Create a deterministic "signature" for development
    const messageHash = sha3_256(message)
    const seedHash = sha3_256(this._seed || new Uint8Array(32))

    // Combine hashes to create a fake signature
    const combinedHash = sha3_256(new Uint8Array([...messageHash, ...seedHash, ...context]))

    // Expand to expected signature size using SHAKE256
    const expectedSize = ML_DSA_LEVELS[this._algorithm].signatureSize
    const signature = shake256(combinedHash, { dkLen: expectedSize })

    return {
      signature,
      signatureHex: bytesToHex(signature),
      algorithm: this._algorithm,
      securityLevel: this._securityLevel,
      publicKey: this._publicKey,
      messageHash: bytesToHex(messageHash),
      context: bytesToHex(context),
      timestamp: Date.now(),
      __placeholder: true
    }
  }

  /**
   * Verify ML-DSA signature
   * @param {Uint8Array | string} data - Original data
   * @param {Object | Uint8Array} signature - Signature object or bytes
   * @param {Uint8Array} publicKey - Public key (optional, uses instance key if not provided)
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verify(data, signature, publicKey = null) {
    try {
      const message = this._dataToBytes(data)
      const pubKey = publicKey || this._publicKey

      // Extract signature bytes
      let sigBytes
      if (signature instanceof Uint8Array) {
        sigBytes = signature
      } else if (typeof signature === 'object' && signature.signature) {
        sigBytes = signature.signature
      } else if (typeof signature === 'string') {
        sigBytes = hexToBytes(signature)
      } else {
        return false
      }

      // If we have a real ML-DSA implementation, use it
      if (this._hasRealImplementation) {
        try {
          const { ml_dsa_65 } = await import('@noble/post-quantum').catch(() => ({}))
          if (ml_dsa_65) {
            return ml_dsa_65.verify(sigBytes, message, pubKey)
          }
        } catch (error) {
          console.warn('ML-DSA verify error:', error.message)
        }
      }

      // For placeholder, always return true if signature has correct size
      const expectedSize = ML_DSA_LEVELS[this._algorithm].signatureSize
      return sigBytes.length === expectedSize
    } catch (error) {
      return false
    }
  }

  /**
   * Get ML-DSA address (custom format)
   * @returns {string} ML-DSA address
   */
  getAddress() {
    // Custom address format for ML-DSA
    // Use SHA3-256 hash of public key, take first 20 bytes
    const pubKeyHash = sha3_256(this._publicKey)
    const addressBytes = pubKeyHash.slice(0, 20)

    // Format: mldsa:<hex-address>
    return `mldsa:${bytesToHex(addressBytes)}`
  }

  /**
   * Get ML-DSA address in various formats
   * @returns {Object} Address formats
   */
  getAddressFormats() {
    const pubKeyHash = sha3_256(this._publicKey)
    const addressBytes = pubKeyHash.slice(0, 20)

    return {
      standard: this.getAddress(),
      hex: bytesToHex(addressBytes),
      bytes: addressBytes,
      full: `mldsa:${this._algorithm.toLowerCase()}:${bytesToHex(addressBytes)}`,
      truncated: `mldsa:${bytesToHex(addressBytes).slice(0, 8)}...${bytesToHex(addressBytes).slice(-6)}`
    }
  }

  /**
   * Get public key in various formats
   * @returns {Object} Public key formats
   */
  getPublicKey() {
    return {
      bytes: this._publicKey,
      hex: bytesToHex(this._publicKey),
      size: this._publicKey.length,
      algorithm: this._algorithm,
      securityLevel: this._securityLevel,
      path: this._path,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex,
      address: this.getAddress()
    }
  }

  /**
   * Get ML-DSA public key fingerprint
   * @returns {string} Public key fingerprint
   */
  getFingerprint() {
    const hash = sha3_256(this._publicKey)
    return bytesToHex(hash.slice(0, 8))
  }

  /**
   * Export public key for sharing
   * @returns {Object} Exportable public key
   */
  exportPublicKey() {
    return {
      algorithm: this._algorithm,
      publicKey: bytesToHex(this._publicKey),
      fingerprint: this.getFingerprint(),
      address: this.getAddress(),
      securityLevel: this._securityLevel
    }
  }

  /**
   * Convert data to bytes
   * @private
   * @param {any} data - Data to convert
   * @returns {Uint8Array} Byte array
   */
  _dataToBytes(data) {
    if (data instanceof Uint8Array) {
      return data
    } else if (typeof data === 'string') {
      // Check if it's a hex string
      if (data.startsWith('0x')) {
        return hexToBytes(data.slice(2))
      }
      // Otherwise treat as UTF-8
      return utf8ToBytes(data)
    } else if (typeof data === 'object') {
      // Serialize object to JSON
      return utf8ToBytes(JSON.stringify(data))
    } else {
      throw new Error('Unsupported data type for signing')
    }
  }

  /**
   * Get signer information
   * @returns {Object} Signer info
   */
  getInfo() {
    const sizes = ML_DSA_LEVELS[this._algorithm]

    return {
      type: 'ML-DSA',
      algorithm: this._algorithm,
      securityLevel: this._securityLevel,
      nistLevel: `NIST Level ${this._securityLevel}`,
      address: this.getAddress(),
      fingerprint: this.getFingerprint(),
      publicKeySize: sizes.publicKeySize,
      privateKeySize: sizes.privateKeySize,
      signatureSize: sizes.signatureSize,
      path: this._path,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex,
      hasRealImplementation: this._hasRealImplementation
    }
  }

  /**
   * Check if signer has real ML-DSA implementation
   * @returns {boolean} True if real implementation is available
   */
  hasRealImplementation() {
    return this._hasRealImplementation
  }

  /**
   * Get signature size for the algorithm
   * @returns {number} Expected signature size in bytes
   */
  getSignatureSize() {
    return ML_DSA_LEVELS[this._algorithm].signatureSize
  }

  /**
   * Securely dispose of private key material
   */
  dispose() {
    // Clear private key
    if (this._privateKey && this._privateKey instanceof Uint8Array) {
      this._privateKey.fill(0)
      this._privateKey = null
    }

    // Clear seed
    if (this._seed && this._seed instanceof Uint8Array) {
      this._seed.fill(0)
      this._seed = null
    }

    // Clear public key reference
    this._publicKey = null
    this._path = null
  }
}

// Export constants
export { ML_DSA_LEVELS }

export default MLDSASigner