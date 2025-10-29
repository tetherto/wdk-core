/**
 * Dual Signature Usage Example
 *
 * Demonstrates how to use the DualSignatureProtocol with the Tether WDK
 * to create wallets that support both ECDSA (for Ethereum) and ML-DSA
 * (for post-quantum verification).
 */

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { DualSignatureProtocol } from '../src/protocols/dual-signature-protocol.js'

// Optional: Custom verification network client
class VerificationNetworkClient {
  constructor(url) {
    this.url = url
  }

  async submitMLDSASignature(txHash, signature, publicKey) {
    // In a real implementation, this would submit to your off-chain network
    console.log('Submitting ML-DSA signature to verification network...')
    console.log('  Transaction Hash:', txHash)
    console.log('  ML-DSA Signature Length:', signature.signature.length, 'bytes')
    console.log('  Public Key Fingerprint:', publicKey.fingerprint)

    // Simulate network submission
    return {
      success: true,
      verificationId: `verify_${Date.now()}`,
      timestamp: new Date().toISOString()
    }
  }
}

async function main() {
  console.log('=== Dual Signature Wallet Example ===\n')

  // Step 1: Initialize WDK with a seed phrase
  const seed = process.env.SEED_PHRASE || WDK.getRandomSeedPhrase()
  console.log('Generated seed phrase:', seed)
  console.log('(Save this securely - it controls both ECDSA and ML-DSA keys!)\n')

  // Step 2: Create WDK instance and register Ethereum wallet
  const wdk = new WDK(seed)
    .registerWallet('ethereum', WalletManagerEvm, {
      chainId: 1,
      rpcUrl: process.env.ETH_RPC_URL || 'https://eth.public-rpc.com'
    })

  // Step 3: Register DualSignatureProtocol globally for all Ethereum accounts
  wdk.registerProtocol('ethereum', 'dual', DualSignatureProtocol, {
    ecdsaEnabled: true,
    mldsaEnabled: true,
    defaultSignatureType: 'ecdsa', // Default to ECDSA for compatibility
    mldsaAlgorithm: 'ML-DSA-65'    // NIST Security Level 3
  })

  console.log('✓ WDK configured with dual-signature support\n')

  // Step 4: Get an account (automatically has dual-signature capability)
  const account = await wdk.getAccount('ethereum', 0)
  console.log('✓ Account 0 retrieved\n')

  // Step 5: Access the dual-signature protocol
  const dualSig = account.getDualSignatureProtocol('dual')

  // Step 6: Display both addresses
  console.log('=== Account Addresses ===')
  const addresses = await dualSig.getAddresses()
  console.log('Ethereum (ECDSA):', addresses.ethereum)
  console.log('Ethereum Checksum:', addresses.ethereumChecksum)
  console.log('ML-DSA:', addresses.mldsa)
  console.log('ML-DSA Truncated:', addresses.mldsaFormats.truncated)
  console.log()

  // Step 7: Display public key information
  console.log('=== Public Keys ===')
  const publicKeys = await dualSig.getPublicKeys()
  console.log('ECDSA Public Key (compressed):', publicKeys.ecdsa.compressed.substring(0, 20) + '...')
  console.log('ML-DSA Public Key Size:', publicKeys.mldsa.size, 'bytes')
  console.log('ML-DSA Fingerprint:', await dualSig.getFingerprints().then(f => f.mldsa))
  console.log()

  // Step 8: Demonstrate different signing methods
  console.log('=== Signing Demonstrations ===\n')

  // Example transaction data
  const transaction = {
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    value: '1000000000000000000', // 1 ETH in wei
    data: '0x',
    nonce: 0,
    gasPrice: '20000000000',
    gasLimit: 21000,
    chainId: 1
  }

  // 8a. Sign with ECDSA only (for on-chain Ethereum)
  console.log('1. ECDSA Signature (for on-chain):')
  const ecdsaSignature = await dualSig.signWithECDSA(transaction)
  console.log('  R:', ecdsaSignature.r.substring(0, 20) + '...')
  console.log('  S:', ecdsaSignature.s.substring(0, 20) + '...')
  console.log('  V:', ecdsaSignature.v)
  console.log()

  // 8b. Sign with ML-DSA only (for off-chain verification)
  console.log('2. ML-DSA Signature (for off-chain):')
  const mldsaSignature = await dualSig.signWithMLDSA(transaction)
  console.log('  Algorithm:', mldsaSignature.algorithm)
  console.log('  Security Level:', mldsaSignature.securityLevel)
  console.log('  Signature Size:', mldsaSignature.signature.length, 'bytes')
  console.log('  Signature (hex):', mldsaSignature.signatureHex.substring(0, 40) + '...')
  if (mldsaSignature.__placeholder) {
    console.log('  ⚠️  Note: Using placeholder implementation (install ML-DSA library for production)')
  }
  console.log()

  // 8c. Create dual signature (both at once)
  console.log('3. Dual Signature (both ECDSA and ML-DSA):')
  const dualSignature = await dualSig.dualSign(transaction)
  console.log('  ECDSA present:', dualSignature.ecdsa !== null)
  console.log('  ML-DSA present:', dualSignature.mldsa !== null)
  console.log('  Timestamp:', new Date(dualSignature.timestamp).toISOString())
  console.log()

  // Step 9: Demonstrate personal message signing (EIP-191)
  console.log('=== Personal Message Signing ===')
  const message = 'Hello, quantum-resistant world!'
  const messageSignature = await dualSig.signMessageWithECDSA(message)
  console.log('Message:', message)
  console.log('ECDSA Signature:', messageSignature.signature.substring(0, 40) + '...')
  console.log()

  // Step 10: Demonstrate hybrid transaction flow
  console.log('=== Hybrid Transaction Flow ===')
  console.log('(On-chain ECDSA + Off-chain ML-DSA verification)\n')

  // Initialize verification network client
  const verificationNetwork = new VerificationNetworkClient('https://verify.example.com')

  // Simulate hybrid transaction
  async function hybridTransaction(tx) {
    console.log('1. Signing transaction with ECDSA for Ethereum...')
    const ecdsaSig = await dualSig.signTransactionWithECDSA(tx)
    console.log('   ✓ Transaction signed with ECDSA')

    // In production, you would send this to Ethereum
    const mockTxHash = '0x' + Array(64).fill(0).map(() =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    console.log('   ✓ Transaction sent to Ethereum:', mockTxHash.substring(0, 20) + '...')

    console.log('\n2. Creating ML-DSA signature for verification network...')
    const mldsaSig = await dualSig.signWithMLDSA(tx)
    console.log('   ✓ ML-DSA signature created')

    console.log('\n3. Submitting to verification network...')
    const verificationResult = await verificationNetwork.submitMLDSASignature(
      mockTxHash,
      mldsaSig,
      await dualSig.getFingerprints()
    )
    console.log('   ✓ Verification ID:', verificationResult.verificationId)

    return {
      txHash: mockTxHash,
      ecdsaSignature: ecdsaSig,
      mldsaSignature: mldsaSig,
      verificationId: verificationResult.verificationId
    }
  }

  const hybridResult = await hybridTransaction(transaction)
  console.log('\n✓ Hybrid transaction complete!')
  console.log('  Ethereum TX:', hybridResult.txHash.substring(0, 20) + '...')
  console.log('  Verification ID:', hybridResult.verificationId)
  console.log()

  // Step 11: Export public keys for sharing
  console.log('=== Exportable Public Keys ===')
  const exportedKeys = await dualSig.exportPublicKeys()
  console.log('Shareable public key data:')
  console.log(JSON.stringify(exportedKeys, null, 2))
  console.log()

  // Step 12: Protocol information
  console.log('=== Protocol Information ===')
  const protocolInfo = await dualSig.getInfo()
  console.log('Protocol:', protocolInfo.protocol)
  console.log('Version:', protocolInfo.version)
  console.log('ECDSA Enabled:', protocolInfo.config.ecdsaEnabled)
  console.log('ML-DSA Enabled:', protocolInfo.config.mldsaEnabled)
  console.log('ML-DSA Algorithm:', protocolInfo.config.mldsaAlgorithm)
  console.log('Default Signature Type:', protocolInfo.config.defaultSignatureType)
  console.log()

  // Step 13: Multiple accounts
  console.log('=== Multiple Accounts ===')
  const account1 = await wdk.getAccount('ethereum', 1)
  const dualSig1 = account1.getDualSignatureProtocol('dual')
  const addresses1 = await dualSig1.getAddresses()

  console.log('Account 1 Ethereum:', addresses1.ethereum)
  console.log('Account 1 ML-DSA:', addresses1.mldsa)
  console.log('\nNote: Each account has unique ECDSA and ML-DSA keys, all derived from the same seed!')
  console.log()

  // Step 14: Cleanup
  console.log('=== Cleanup ===')
  dualSig.dispose()
  dualSig1.dispose()
  wdk.dispose()
  console.log('✓ All sensitive data securely disposed')
  console.log()

  console.log('=== Example Complete ===')
  console.log('This example demonstrated:')
  console.log('• Dual-signature wallet creation')
  console.log('• ECDSA signing for Ethereum compatibility')
  console.log('• ML-DSA signing for quantum resistance')
  console.log('• Hybrid transaction flow')
  console.log('• Multiple account derivation')
  console.log('• Secure key disposal')
}

// Run the example
main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})