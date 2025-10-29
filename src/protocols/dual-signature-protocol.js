/**
 * Dual Signature Protocol
 *
 * Provides dual-signature capabilities (ECDSA + ML-DSA) for wallet accounts
 * following the WDK protocol pattern.
 */

import { DualKeyDerivation } from '../crypto/dual-key-derivation.js'
import { ECDSASigner } from '../crypto/ecdsa-signer.js'
import { MLDSASigner } from '../crypto/mldsa-signer.js'

/**
 * Base class for dual-signature protocols
 * Extends wallet accounts with both ECDSA and ML-DSA signing capabilities
 */
export class DualSignatureProtocol {
  /**
   * @param {IWalletAccount} account - The wallet account to extend
   * @param {DualSignatureConfig} config - Protocol configuration
   */
  constructor(account, config = {}) {
    if (!account) {
      throw new Error('Account is required for DualSignatureProtocol')
    }

    this._account = account
    this._config = {
      ecdsaEnabled: true,
      mldsaEnabled: true,
      defaultSignatureType: 'ecdsa', // 'ecdsa' | 'mldsa' | 'dual'
      mldsaAlgorithm: 'ML-DSA-65',    // ML-DSA security level
      autoInitialize: true,           // Initialize on first use
      ...config
    }

    // Key derivation and signers
    this._keyDerivation = null
    this._ecdsaSigner = null
    this._mldsaSigner = null

    // State
    this._initialized = false
    this._accountIndex = null
    this._addressIndex = null

    // Cache
    this._addressCache = {}
    this._publicKeyCache = {}
  }

  /**
   * Initialize the protocol with seed and derive keys
   * @private
   */
  async _initialize() {
    if (this._initialized) return

    try {
      // Get seed from config or account
      let seed = this._config.seed

      // If no seed provided, try to get from account
      if (!seed) {
        if (typeof this._account.getSeed === 'function') {
          seed = await this._account.getSeed()
        } else if (this._account._seed) {
          seed = this._account._seed
        } else {
          throw new Error('No seed available for key derivation')
        }
      }

      // Initialize key derivation
      this._keyDerivation = new DualKeyDerivation(seed)

      // Get account and address indices
      this._accountIndex = await this._getAccountIndex()
      this._addressIndex = await this._getAddressIndex()

      // Derive and initialize ECDSA signer if enabled
      if (this._config.ecdsaEnabled) {
        const ecdsaKey = await this._keyDerivation.deriveECDSAKey(
          this._accountIndex,
          this._addressIndex
        )
        this._ecdsaSigner = new ECDSASigner(ecdsaKey)
      }

      // Derive and initialize ML-DSA signer if enabled
      if (this._config.mldsaEnabled) {
        const mldsaKey = await this._keyDerivation.deriveMLDSAKey(
          this._accountIndex,
          this._addressIndex
        )
        this._mldsaSigner = new MLDSASigner(mldsaKey)
      }

      this._initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize DualSignatureProtocol: ${error.message}`)
    }
  }

  /**
   * Get account index from account or config
   * @private
   * @returns {Promise<number>} Account index
   */
  async _getAccountIndex() {
    if (this._config.accountIndex !== undefined) {
      return this._config.accountIndex
    }

    if (typeof this._account.getAccountIndex === 'function') {
      return await this._account.getAccountIndex()
    }

    if (this._account.accountIndex !== undefined) {
      return this._account.accountIndex
    }

    return 0 // Default to first account
  }

  /**
   * Get address index from account or config
   * @private
   * @returns {Promise<number>} Address index
   */
  async _getAddressIndex() {
    if (this._config.addressIndex !== undefined) {
      return this._config.addressIndex
    }

    if (typeof this._account.getAddressIndex === 'function') {
      return await this._account.getAddressIndex()
    }

    if (this._account.addressIndex !== undefined) {
      return this._account.addressIndex
    }

    return 0 // Default to first address
  }

  /**
   * Ensure protocol is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this._initialized && this._config.autoInitialize) {
      await this._initialize()
    } else if (!this._initialized) {
      throw new Error('DualSignatureProtocol not initialized. Call initialize() first.')
    }
  }

  /**
   * Sign data with ECDSA (for on-chain Ethereum transactions)
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @returns {Promise<ECDSASignature>} ECDSA signature
   */
  async signWithECDSA(data, options = {}) {
    await this._ensureInitialized()

    if (!this._config.ecdsaEnabled || !this._ecdsaSigner) {
      throw new Error('ECDSA signing is not enabled')
    }

    return await this._ecdsaSigner.sign(data, options)
  }

  /**
   * Sign message with ECDSA (EIP-191 personal sign)
   * @param {string} message - Message to sign
   * @returns {Promise<ECDSASignature>} ECDSA signature
   */
  async signMessageWithECDSA(message) {
    await this._ensureInitialized()

    if (!this._config.ecdsaEnabled || !this._ecdsaSigner) {
      throw new Error('ECDSA signing is not enabled')
    }

    return await this._ecdsaSigner.signMessage(message)
  }

  /**
   * Sign transaction with ECDSA
   * @param {Object} transaction - Transaction object
   * @returns {Promise<Object>} Signed transaction
   */
  async signTransactionWithECDSA(transaction) {
    await this._ensureInitialized()

    if (!this._config.ecdsaEnabled || !this._ecdsaSigner) {
      throw new Error('ECDSA signing is not enabled')
    }

    return await this._ecdsaSigner.signTransaction(transaction)
  }

  /**
   * Sign data with ML-DSA (for off-chain verification network)
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @returns {Promise<MLDSASignature>} ML-DSA signature
   */
  async signWithMLDSA(data, options = {}) {
    await this._ensureInitialized()

    if (!this._config.mldsaEnabled || !this._mldsaSigner) {
      throw new Error('ML-DSA signing is not enabled')
    }

    return await this._mldsaSigner.sign(data, options)
  }

  /**
   * Create dual signature (both ECDSA and ML-DSA)
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @returns {Promise<DualSignature>} Both signatures
   */
  async dualSign(data, options = {}) {
    await this._ensureInitialized()

    // Sign with both algorithms in parallel
    const [ecdsaSignature, mldsaSignature] = await Promise.all([
      this._config.ecdsaEnabled
        ? this.signWithECDSA(data, options)
        : Promise.resolve(null),
      this._config.mldsaEnabled
        ? this.signWithMLDSA(data, options)
        : Promise.resolve(null)
    ])

    return {
      ecdsa: ecdsaSignature,
      mldsa: mldsaSignature,
      data,
      timestamp: Date.now(),
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex
    }
  }

  /**
   * Verify ECDSA signature
   * @param {Uint8Array | string} data - Original data
   * @param {Object} signature - ECDSA signature
   * @param {Uint8Array} publicKey - Optional public key
   * @returns {Promise<boolean>} True if valid
   */
  async verifyECDSA(data, signature, publicKey = null) {
    await this._ensureInitialized()

    if (!this._ecdsaSigner) {
      throw new Error('ECDSA signer not available')
    }

    return this._ecdsaSigner.verify(data, signature, publicKey)
  }

  /**
   * Verify ML-DSA signature
   * @param {Uint8Array | string} data - Original data
   * @param {Object} signature - ML-DSA signature
   * @param {Uint8Array} publicKey - Optional public key
   * @returns {Promise<boolean>} True if valid
   */
  async verifyMLDSA(data, signature, publicKey = null) {
    await this._ensureInitialized()

    if (!this._mldsaSigner) {
      throw new Error('ML-DSA signer not available')
    }

    return await this._mldsaSigner.verify(data, signature, publicKey)
  }

  /**
   * Get public keys for both signature types
   * @returns {Promise<DualPublicKeys>} Public keys
   */
  async getPublicKeys() {
    await this._ensureInitialized()

    // Check cache
    const cacheKey = `${this._accountIndex}-${this._addressIndex}`
    if (this._publicKeyCache[cacheKey]) {
      return this._publicKeyCache[cacheKey]
    }

    const publicKeys = {
      ecdsa: this._ecdsaSigner ? this._ecdsaSigner.getPublicKey() : null,
      mldsa: this._mldsaSigner ? this._mldsaSigner.getPublicKey() : null
    }

    // Cache result
    this._publicKeyCache[cacheKey] = publicKeys

    return publicKeys
  }

  /**
   * Get addresses derived from public keys
   * @returns {Promise<DualAddresses>} Addresses
   */
  async getAddresses() {
    await this._ensureInitialized()

    // Check cache
    const cacheKey = `${this._accountIndex}-${this._addressIndex}`
    if (this._addressCache[cacheKey]) {
      return this._addressCache[cacheKey]
    }

    const addresses = {
      ethereum: this._ecdsaSigner ? this._ecdsaSigner.getAddress() : null,
      ethereumChecksum: this._ecdsaSigner ? this._ecdsaSigner.getChecksumAddress() : null,
      mldsa: this._mldsaSigner ? this._mldsaSigner.getAddress() : null,
      mldsaFormats: this._mldsaSigner ? this._mldsaSigner.getAddressFormats() : null
    }

    // Cache result
    this._addressCache[cacheKey] = addresses

    return addresses
  }

  /**
   * Get fingerprints for both key types
   * @returns {Promise<Object>} Fingerprints
   */
  async getFingerprints() {
    await this._ensureInitialized()

    return {
      ecdsa: this._ecdsaSigner
        ? this._ecdsaSigner.getPublicKey().compressed.slice(0, 16)
        : null,
      mldsa: this._mldsaSigner
        ? this._mldsaSigner.getFingerprint()
        : null
    }
  }

  /**
   * Export public keys for sharing
   * @returns {Promise<Object>} Exportable public keys
   */
  async exportPublicKeys() {
    await this._ensureInitialized()

    const addresses = await this.getAddresses()
    const publicKeys = await this.getPublicKeys()
    const fingerprints = await this.getFingerprints()

    return {
      ecdsa: this._ecdsaSigner ? {
        address: addresses.ethereum,
        checksumAddress: addresses.ethereumChecksum,
        publicKey: publicKeys.ecdsa.compressed,
        fingerprint: fingerprints.ecdsa,
        curve: 'secp256k1'
      } : null,
      mldsa: this._mldsaSigner ? {
        address: addresses.mldsa,
        publicKey: publicKeys.mldsa.hex,
        fingerprint: fingerprints.mldsa,
        algorithm: this._config.mldsaAlgorithm
      } : null,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex
    }
  }

  /**
   * Sign with default signature type
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @returns {Promise<Object>} Signature(s)
   */
  async sign(data, options = {}) {
    const signatureType = options.type || this._config.defaultSignatureType

    switch (signatureType) {
      case 'ecdsa':
        return await this.signWithECDSA(data, options)
      case 'mldsa':
        return await this.signWithMLDSA(data, options)
      case 'dual':
        return await this.dualSign(data, options)
      default:
        throw new Error(`Invalid signature type: ${signatureType}`)
    }
  }

  /**
   * Get protocol information
   * @returns {Promise<Object>} Protocol info
   */
  async getInfo() {
    await this._ensureInitialized()

    const addresses = await this.getAddresses()

    return {
      protocol: 'DualSignatureProtocol',
      version: '1.0.0',
      initialized: this._initialized,
      config: {
        ecdsaEnabled: this._config.ecdsaEnabled,
        mldsaEnabled: this._config.mldsaEnabled,
        defaultSignatureType: this._config.defaultSignatureType,
        mldsaAlgorithm: this._config.mldsaAlgorithm
      },
      signers: {
        ecdsa: this._ecdsaSigner ? this._ecdsaSigner.getInfo() : null,
        mldsa: this._mldsaSigner ? this._mldsaSigner.getInfo() : null
      },
      addresses,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex
    }
  }

  /**
   * Check if protocol is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this._initialized
  }

  /**
   * Manually initialize the protocol
   * @returns {Promise<void>}
   */
  async initialize() {
    await this._initialize()
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this._addressCache = {}
    this._publicKeyCache = {}
  }

  /**
   * Dispose and clear sensitive data
   */
  dispose() {
    // Clear signers
    if (this._ecdsaSigner) {
      this._ecdsaSigner.dispose()
      this._ecdsaSigner = null
    }

    if (this._mldsaSigner) {
      this._mldsaSigner.dispose()
      this._mldsaSigner = null
    }

    // Clear key derivation
    if (this._keyDerivation) {
      this._keyDerivation.dispose()
      this._keyDerivation = null
    }

    // Clear caches
    this.clearCaches()

    // Clear state
    this._initialized = false
    this._account = null
    this._config = null
  }
}

/**
 * @typedef {Object} DualSignatureConfig
 * @property {boolean} [ecdsaEnabled=true] - Enable ECDSA signing
 * @property {boolean} [mldsaEnabled=true] - Enable ML-DSA signing
 * @property {'ecdsa'|'mldsa'|'dual'} [defaultSignatureType='ecdsa'] - Default signature type
 * @property {'ML-DSA-44'|'ML-DSA-65'|'ML-DSA-87'} [mldsaAlgorithm='ML-DSA-65'] - ML-DSA security level
 * @property {boolean} [autoInitialize=true] - Auto-initialize on first use
 * @property {Uint8Array|string} [seed] - Optional seed override
 * @property {number} [accountIndex] - Optional account index override
 * @property {number} [addressIndex] - Optional address index override
 */

/**
 * @typedef {Object} DualSignature
 * @property {ECDSASignature|null} ecdsa - ECDSA signature
 * @property {MLDSASignature|null} mldsa - ML-DSA signature
 * @property {Uint8Array|string|Object} data - Original data
 * @property {number} timestamp - Signature timestamp
 * @property {number} accountIndex - Account index used
 * @property {number} addressIndex - Address index used
 */

/**
 * @typedef {Object} DualPublicKeys
 * @property {Object|null} ecdsa - ECDSA public key info
 * @property {Object|null} mldsa - ML-DSA public key info
 */

/**
 * @typedef {Object} DualAddresses
 * @property {string|null} ethereum - Ethereum address from ECDSA
 * @property {string|null} ethereumChecksum - Checksummed Ethereum address
 * @property {string|null} mldsa - ML-DSA address
 * @property {Object|null} mldsaFormats - ML-DSA address in various formats
 */

export default DualSignatureProtocol