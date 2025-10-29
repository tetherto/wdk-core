/**
 * ECDSA Signer Module
 *
 * Provides ECDSA signing and verification capabilities using secp256k1 curve
 * for Ethereum compatibility.
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

/**
 * ECDSA Signer class for Ethereum-compatible signatures
 */
export class ECDSASigner {
  /**
   * @param {Object} keyPair - Key pair object from DualKeyDerivation
   * @param {Uint8Array} keyPair.privateKey - 32-byte private key
   * @param {Uint8Array} keyPair.publicKey - 33 or 65-byte public key
   * @param {string} keyPair.path - HD derivation path
   */
  constructor(keyPair) {
    if (!keyPair || !keyPair.privateKey || !keyPair.publicKey) {
      throw new Error('Invalid key pair provided to ECDSASigner')
    }

    this._privateKey = keyPair.privateKey
    this._publicKey = keyPair.publicKey
    this._path = keyPair.path || ''
    this._accountIndex = keyPair.accountIndex || 0
    this._addressIndex = keyPair.addressIndex || 0
  }

  /**
   * Sign data with ECDSA (secp256k1)
   * @param {Uint8Array | string | Object} data - Data to sign
   * @param {Object} options - Signing options
   * @param {boolean} options.hashMessage - Whether to hash the message (default: true)
   * @param {boolean} options.addPrefix - Add Ethereum message prefix (default: false)
   * @returns {Object} ECDSA signature
   */
  async sign(data, options = {}) {
    const { hashMessage = true, addPrefix = false } = options

    // Convert data to bytes
    let message = this._dataToBytes(data)

    // Add Ethereum message prefix if requested (EIP-191)
    if (addPrefix) {
      const prefix = `\x19Ethereum Signed Message:\n${message.length}`
      const prefixBytes = utf8ToBytes(prefix)
      message = new Uint8Array([...prefixBytes, ...message])
    }

    // Hash the message if requested
    const messageHash = hashMessage ? keccak_256(message) : message

    // Sign with secp256k1
    const signature = secp256k1.sign(messageHash, this._privateKey)

    // Get recovery parameter for Ethereum
    const recovery = signature.recovery

    return {
      r: bytesToHex(signature.r.toString(16).padStart(64, '0')),
      s: bytesToHex(signature.s.toString(16).padStart(64, '0')),
      v: recovery + 27, // Ethereum uses 27/28 instead of 0/1
      signature: signature.toCompactHex(),
      compact: signature.toCompactHex(),
      messageHash: bytesToHex(messageHash),
      recovery
    }
  }

  /**
   * Sign a message with Ethereum prefix (EIP-191)
   * @param {string} message - Message to sign
   * @returns {Object} ECDSA signature
   */
  async signMessage(message) {
    return this.sign(message, { hashMessage: true, addPrefix: true })
  }

  /**
   * Sign transaction data
   * @param {Object} tx - Transaction object
   * @returns {Object} Signed transaction
   */
  async signTransaction(tx) {
    // This would typically use RLP encoding and EIP-155
    // For now, we'll sign the transaction data directly
    const txData = this._serializeTransaction(tx)
    const signature = await this.sign(txData, { hashMessage: true, addPrefix: false })

    return {
      ...tx,
      signature,
      v: signature.v,
      r: signature.r,
      s: signature.s
    }
  }

  /**
   * Verify ECDSA signature
   * @param {Uint8Array | string} data - Original data
   * @param {Object} signature - Signature object
   * @param {Uint8Array} publicKey - Public key (optional, uses instance key if not provided)
   * @returns {boolean} True if signature is valid
   */
  verify(data, signature, publicKey = null) {
    try {
      const message = this._dataToBytes(data)
      const messageHash = keccak_256(message)

      const pubKey = publicKey || this._publicKey
      const sig = typeof signature === 'string' ? hexToBytes(signature) : signature

      return secp256k1.verify(sig, messageHash, pubKey)
    } catch (error) {
      return false
    }
  }

  /**
   * Get Ethereum address from public key
   * @returns {string} Ethereum address (0x-prefixed)
   */
  getAddress() {
    // Get uncompressed public key (remove first byte if it's 0x04)
    let pubKey = this._publicKey
    if (pubKey.length === 65 && pubKey[0] === 0x04) {
      pubKey = pubKey.slice(1)
    } else if (pubKey.length === 33) {
      // Decompress the public key
      const point = secp256k1.ProjectivePoint.fromHex(bytesToHex(pubKey))
      const uncompressed = point.toRawBytes(false)
      pubKey = uncompressed.slice(1) // Remove 0x04 prefix
    }

    // Hash the public key
    const pubKeyHash = keccak_256(pubKey)

    // Take last 20 bytes as address
    const address = pubKeyHash.slice(-20)

    return '0x' + bytesToHex(address)
  }

  /**
   * Get checksummed Ethereum address (EIP-55)
   * @returns {string} Checksummed address
   */
  getChecksumAddress() {
    const address = this.getAddress().toLowerCase().replace('0x', '')
    const hash = bytesToHex(keccak_256(utf8ToBytes(address)))

    let checksummed = '0x'
    for (let i = 0; i < address.length; i++) {
      if (parseInt(hash[i], 16) >= 8) {
        checksummed += address[i].toUpperCase()
      } else {
        checksummed += address[i]
      }
    }

    return checksummed
  }

  /**
   * Get public key in various formats
   * @returns {Object} Public key formats
   */
  getPublicKey() {
    const compressed = this._getCompressedPublicKey()
    const uncompressed = this._getUncompressedPublicKey()

    return {
      compressed: bytesToHex(compressed),
      uncompressed: bytesToHex(uncompressed),
      raw: this._publicKey,
      path: this._path,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex
    }
  }

  /**
   * Get compressed public key
   * @private
   * @returns {Uint8Array} 33-byte compressed public key
   */
  _getCompressedPublicKey() {
    if (this._publicKey.length === 33) {
      return this._publicKey
    }

    // Compress the public key
    const point = secp256k1.ProjectivePoint.fromHex(bytesToHex(this._publicKey))
    return point.toRawBytes(true)
  }

  /**
   * Get uncompressed public key
   * @private
   * @returns {Uint8Array} 65-byte uncompressed public key
   */
  _getUncompressedPublicKey() {
    if (this._publicKey.length === 65) {
      return this._publicKey
    }

    // Decompress the public key
    const point = secp256k1.ProjectivePoint.fromHex(bytesToHex(this._publicKey))
    return point.toRawBytes(false)
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
   * Serialize transaction for signing
   * @private
   * @param {Object} tx - Transaction object
   * @returns {Uint8Array} Serialized transaction
   */
  _serializeTransaction(tx) {
    // Simplified transaction serialization
    // In production, use RLP encoding with EIP-155
    const fields = [
      tx.nonce || 0,
      tx.gasPrice || 0,
      tx.gasLimit || tx.gas || 21000,
      tx.to || '',
      tx.value || 0,
      tx.data || '0x',
      tx.chainId || 1
    ]

    return utf8ToBytes(JSON.stringify(fields))
  }

  /**
   * Recover public key from signature
   * @param {Uint8Array | string} message - Original message
   * @param {Object} signature - Signature with r, s, v
   * @returns {Uint8Array} Recovered public key
   */
  recoverPublicKey(message, signature) {
    const messageBytes = this._dataToBytes(message)
    const messageHash = keccak_256(messageBytes)

    const recovery = (signature.v - 27) % 2
    const sig = new secp256k1.Signature(
      BigInt('0x' + signature.r),
      BigInt('0x' + signature.s)
    )

    return sig.recoverPublicKey(messageHash, recovery).toRawBytes(false)
  }

  /**
   * Export private key (handle with care!)
   * @returns {Object} Private key in various formats
   */
  exportPrivateKey() {
    return {
      hex: bytesToHex(this._privateKey),
      raw: new Uint8Array(this._privateKey), // Create copy
      warning: 'Handle with extreme care! Never share or log private keys.'
    }
  }

  /**
   * Get signer information
   * @returns {Object} Signer info
   */
  getInfo() {
    return {
      type: 'ECDSA',
      curve: 'secp256k1',
      address: this.getAddress(),
      checksumAddress: this.getChecksumAddress(),
      publicKeyCompressed: bytesToHex(this._getCompressedPublicKey()),
      path: this._path,
      accountIndex: this._accountIndex,
      addressIndex: this._addressIndex
    }
  }

  /**
   * Securely dispose of private key material
   */
  dispose() {
    if (this._privateKey && this._privateKey instanceof Uint8Array) {
      this._privateKey.fill(0)
      this._privateKey = null
    }
    this._publicKey = null
    this._path = null
  }
}

export default ECDSASigner