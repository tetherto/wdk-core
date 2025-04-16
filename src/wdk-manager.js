// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { WDKWalletManagementEVM } from '@wdk/wallet-evm'
import { WDKAccountAbstractionEVM } from '@wdk/account-abstraction-evm'

import { WDKWalletManagementTON } from '@wdk/wallet-ton'
import { WDKAccountAbstractionTON } from '@wdk/account-abstraction-ton'

import bip39 from 'bip39'

// #region Type definitions

/**
 * A [BIP-39](https://www.blockplate.com/pages/bip-39-wordlist?srsltid=AfmBOopD-bEKe3mCjbMRpQu-OZlnYK3b28y7IQb5k6XbKsnI1gZFxL9j) seed phrase.
 * @typedef {string} SeedPhrase
 */

/**
 * An object mapping each blockchain to a [BIP-39](https://www.blockplate.com/pages/bip-39-wordlist?srsltid=AfmBOopD-bEKe3mCjbMRpQu-OZlnYK3b28y7IQb5k6XbKsnI1gZFxL9j) seed phrase.
 * @typedef {Object} Seeds
 * @property {SeedPhrase} evm - The seed phrase to use for all evm blockchains.
 * @property {SeedPhrase} ton - The ton's wallet seed phrase.
 */

/**
 * An object containing the account abstraction configuration for each blockchain.
 * @typedef {Object} AccountAbstractionConfig
 * @property {AccountAbstractionConfigEvm} [ethereum] - The account abstraction configuration for ethereum.
 * @property {AccountAbstractionConfigEvm} [arbitrum] - The account abstraction configuration for arbitrum.
 * @property {AccountAbstractionConfigEvm} [polygon] - The account abstraction configuration for polygon.
 * @property {AccountAbstractionConfigTon} [ton] - The account abstraction configuration for ton.
 */

/**
 * An object containing the account abstraction configuration for evm blockchains.
 * @typedef {Object} AccountAbstractionConfigEvm
 * @property {string} rpc - The url of the rpc provider.
 * @property {Object} safe - The safe configuration.
 * @property {string} safe.bundlerUrl - The url of the bundler service.
 * @property {string} safe.paymasterUrl - The url of the paymaster service.
 * @property {string} safe.paymasterAddress - The address of the paymaster smart contract.
 * @property {Object} safe.paymasterToken - The paymaster token.
 * @property {string} safe.paymasterToken.address - The address of the paymaster token.
 */

/**
 * An object containing the account abstraction configuration for the ton blockchain.
 * @typedef {Object} AccountAbstractionConfigTon
 * @property {string} tonApiKey -
 * @property {string} tonApiEndpoint -
 * @property {string} tonCenterApiKey -
 * @property {string} tonCenterEndpoint -
 * @property {Object} paymasterToken -
 * @property {string} paymasterToken.address -
 */

/**
 * @typedef {Object} TransferOptions
 * @property {string} recipient - The address of the recipient.
 * @property {string} token - The address of the token to transfer.
 * @property {number} amount - The amount to transfer (in base unit).
 */

/**
 * @typedef {Object} TransferResult
 * @property {string} hash - The hash of the transfer operation.
 * @property {number} gasCost - The gas cost (in paymaster token).
 */

/**
 * @typedef {Object} SwapOptions
 * @property {string} tokenIn - The address of the token to sell.
 * @property {string} tokenOut - The address of the token to buy.
 * @property {number} [tokenInAmount] - The amount of `tokenIn` tokens to sell (in base unit).
 * @property {number} [tokenOutAmount] - The amount of `tokenOut` tokens to buy (in base unit).
 */

/**
 * @typedef {Object} SwapResult
 * @property {string} hash - The hash of the swap operation.
 * @property {number} gasCost - The gas cost (in paymaster token).
 * @property {number} tokenInAmount - The amount of input tokens sold.
 * @property {number} tokenOutAmount - The amount of output tokens bought.
 */

/**
 * @typedef {Object} BridgeOptions
 * @property {string} targetChain - The identifier of the destination blockchain (e.g. "arbitrum").
 * @property {string} recipient - The address of the recipient.
 * @property {number} amount - The amount of usdt tokens to bridge to the destination chain (in base unit).
 */

/**
 * @typedef {Object} BridgeResult
 * @property {string} hash - The hash of the bridge operation.
 * @property {number} gasCost - The gas cost (in paymaster token).
 * @property {number} bridgeCost - The bridge cost in usdt tokens.
 */

// #endregion

const EVM_BLOCKCHAINS = [
  'ethereum',
  'arbitrum',
  'polygon'
]

const SUPPORTED_BLOCKCHAINS = [
  ...EVM_BLOCKCHAINS,
  'ton'
]

export default class WdkManager {
  #seed
  #accountAbstractionsManagers

  /**
     * Creates a new wallet development kit manager.
     *
     * @param {SeedPhrase | Seeds} seed - A [BIP-39](https://www.blockplate.com/pages/bip-39-wordlist?srsltid=AfmBOopD-bEKe3mCjbMRpQu-OZlnYK3b28y7IQb5k6XbKsnI1gZFxL9j) seed phrase to use for all blockchains, or an object mapping each blockchain to a different seed phrase.
     * @param {AccountAbstractionConfig} accountAbstractionConfig - The account abstraction configuration for each blockchain.
     */
  constructor (seed, accountAbstractionConfig) {
    this.#seed = seed

    this.#accountAbstractionsManagers = { }

    for (const blockchain of EVM_BLOCKCHAINS) {
      const config = accountAbstractionConfig[blockchain]

      if (config) { this.#accountAbstractionsManagers[blockchain] = new WDKAccountAbstractionEVM(config.rpc, config.safe) }
    }

    const config = accountAbstractionConfig.ton

    this.#accountAbstractionsManagers.ton = new WDKAccountAbstractionTON(config)
  }

  /**
     * Returns the abstracted address of an account.
     *
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @returns {Promise<string>} The abstracted address.
     *
     * @example
     * // Get the abstracted address of the ethereum wallet's account at m/44'/60'/0'/0/3
     * const abstractedAddress = await wdk.getAbstractedAddress("ethereum", 3);
     */
  async getAbstractedAddress (blockchain, accountIndex) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      const safe4337Pack = await manager.getSafe4337Pack(accountInfo)

      return await manager.getAbstractedAddress(safe4337Pack)
    }

    if (blockchain == 'ton') {
      return accountInfo.address
    }
  }

  /**
     * Transfers a token to another address.
     *
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<TransferResult>} The transfer's result.
     *
     * @example
     * // Transfer 1.0 USDT from the ethereum wallet's account at index 0 to another address
     * const transfer = await wdk.transfer("ethereum", 0, {
     *     recipient: "0xabc...",
     *     token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
     *     amount: 1_000_000
     * });
     *
     * console.log("Transaction hash:", transfer.hash);
     */
  async transfer (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      return await manager.send({
        ...options,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })
    }

    if (blockchain == 'ton') {
      return await manager.send({
        ...accountInfo,
        recipient: options.recipient,
        amount: options.amount,
        jettonMaster: options.token
      })
    }
  }

  /**
     * Quotes the costs of a transfer operation.
     *
     * @see {@link transfer}
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<Omit<TransferResult, "hash">>} The transfer's quotes.
     *
     * @example
     * // Quote the transfer of 1.0 USDT from the ethereum wallet's account at index 0 to another address
     * const quote = await wdk.quoteTransfer("ethereum", 0, {
     *     recipient: "0xabc...",
     *     token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
     *     amount: 1_000_000
     * });
     *
     * console.log("Gas cost (in paymaster token):", quote.gasCost);
     */
  async quoteTransfer (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      const { success, ...quote } = await manager.quoteSend({
        ...options,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })

      if (!success) { throw new Error('Quote error:', quote.details) }

      return quote
    }

    if (blockchain == 'ton') {
      const { success, ...quote } = await manager.quoteSend({
        ...accountInfo,
        recipient: options.recipient,
        amount: options.amount,
        jettonMaster: options.token
      })

      if (!success) { throw new Error('Quote error:', quote.details) }

      return quote
    }
  }

  /**
     * Swaps a pair of tokens.
     *
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {SwapOptions} options - The swap's options.
     * @returns {Promise<SwapResult>} The swap's result.
     */
  async swap (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      return await manager.swap({
        ...options,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })
    }

    if (blockchain == 'ton') {
      throw new Error('Ton does not support gasless swaps yet.')
    }
  }

  /**
     * Quotes the costs of a swap operation.
     *
     * @see {@link swap}
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {SwapOptions} options - The swap's options.
     * @returns {Promise<Omit<SwapResult, "hash">>} The swap's quotes.
     */
  async quoteSwap (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      const { success, ...quote } = await manager.quoteSwap({
        ...options,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })

      if (!success) { throw new Error('Quote error:', quote.details) }

      return quote
    }

    if (blockchain == 'ton') {
      throw new Error('Ton does not support gasless swaps yet.')
    }
  }

  /**
     * Bridges usdt tokens to a different blockchain.
     *
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {BridgeOptions} options - The bridge's options.
     * @returns {Promise<BridgeResult>} The bridge's result.
     */
  async bridge (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      return await manager.bridge({
        ...options,
        sourceChain: blockchain,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })
    }

    if (blockchain == 'ton') {
      return await manager.bridge({
        ...options,
        ...accountInfo
      })
    }
  }

  /**
     * Quotes the costs of a bridge operation.
     *
     * @see {@link bridge}
     * @param {string} blockchain - A blockchain identifier (e.g., "ethereum").
     * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
     * @param {BridgeOptions} options - The bridge's options.
     * @returns {Promise<Omit<BridgeResult, "hash">>} The bridge's quotes.
     */
  async quoteBridge (blockchain, accountIndex, options) {
    const accountInfo = await this.#getAccountInfo(blockchain, accountIndex)

    const manager = this.#accountAbstractionsManagers[blockchain]

    if (this.#isEvmBlockchain(blockchain)) {
      const { success, ...quote } = await manager.quoteBridge({
        ...options,
        sourceChain: blockchain,
        safe4337Pack: await manager.getSafe4337Pack(accountInfo)
      })

      if (!success) { throw new Error('Quote error:', quote.details) }

      return quote
    }

    if (blockchain == 'ton') {
      const { success, ...quote } = await manager.quoteBridge({
        ...options,
        ...accountInfo
      })

      if (!success) { throw new Error('Quote error:', quote.details) }

      return quote
    }
  }

  /**
     * Returns a random [BIP-39](https://www.blockplate.com/pages/bip-39-wordlist?srsltid=AfmBOopD-bEKe3mCjbMRpQu-OZlnYK3b28y7IQb5k6XbKsnI1gZFxL9j) seed phrase.
     *
     * @returns {SeedPhrase} The seed phrase.
     *
     * @example
     * const seed = WdkManager.getRandomSeedPhrase();
     *
     * // Output: atom raven insect ...
     * console.log(seed);
     */
  static getRandomSeedPhrase () {
    return bip39.generateMnemonic()
  }

  /**
     * Checks if a seed phrase is valid.
     *
     * @param {SeedPhrase} seed - The seed phrase.
     * @returns {boolean} True if the seed phrase is valid.
     */
  static isValidSeedPhrase (seed) {
    return bip39.validateMnemonic(seed)
  }

  async #getAccountInfo (blockchain, accountIndex) {
    const seed = this.#seed

    if (this.#isEvmBlockchain(blockchain)) {
      const manager = new WDKWalletManagementEVM()

      return await manager
        .createWalletByIndex(typeof seed === 'string' ? seed : seed.evm, accountIndex)
    }

    if (blockchain == 'ton') {
      const manager = new WDKWalletManagementTON()

      const accountIndexSeed = manager.getSeed(accountIndex)

      return await manager
        .getWalletDetails(typeof seed === 'string' ? seed.split(' ') : seed.ton, accountIndexSeed)
    }
  }

  #isEvmBlockchain (blockchain) {
    return EVM_BLOCKCHAINS.includes(blockchain)
  }
}
