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
'use strict'

import * as bip39 from 'bip39'

/**
 * Enumeration for all available blockchains.
 *
 * @enum {string}
 */
export const Blockchain = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Polygon: 'polygon',
  Ton: 'ton',
  Bitcoin: 'bitcoin',
  Spark: 'spark',
  Tron: 'tron'
}

const EVM_BLOCKCHAINS = [
  Blockchain.Ethereum,
  Blockchain.Arbitrum,
  Blockchain.Polygon
]

export default class WdkManager {
  _seed
  _config
  _wallets

  /**
   * Creates a new wallet development kit manager.
   *
   * @param {string | Seeds} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase to use for
   *                                all blockchains, or an object mapping each blockchain to a different seed phrase.
   * @param {WdkConfig} config - The configuration for each blockchain.
   */
  constructor (seed, config) {
    this._seed = seed
    this._config = config
    this._wallets = { }

    this._cache = { }
  }

  /**
   * Returns a random [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   *
   * @returns {string} The seed phrase.
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
   * @param {string} seed - The seed phrase.
   * @returns {boolean} True if the seed phrase is valid.
   */
  static isValidSeedPhrase (seed) {
    return bip39.validateMnemonic(seed)
  }

  /**
   * Returns the wallet account for a specific blockchain and index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Return the account for the ethereum blockchain with derivation path m/44'/60'/0'/0/1
   * const account = await wdk.getAccount("ethereum", 1);
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<IWalletAccount>} The account.
  */
  async getAccount (blockchain, index = 0) {
    const wallet = await this._getWalletManager(blockchain)

    return await wallet.getAccount(index)
  }

  /**
   * Returns the wallet account for a specific blockchain and BIP-44 derivation path.
   *
   * @example
   * // Returns the account for the ethereum blockchain with derivation path m/44'/60'/0'/0/1
   * const account = await wdk.getAccountByPath("ethereum", "0'/0/1");
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @returns {Promise<IWalletAccount>} The account.
   */
  async getAccountByPath (blockchain, path) {
    const wallet = await this._getWalletManager(blockchain)

    return await wallet.getAccountByPath(path)
  }

  /**
   * Returns the current fee rates for a specific blockchain.
   *
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @returns {Promise<{ normal: number, fast: number }>} The fee rates (in weis).
   */
  async getFeeRates (blockchain) {
    const wallet = await this._getWalletManager(blockchain)

    return await wallet.getFeeRates()
  }

  /**
   * Returns the address of an account.
   *
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
   * @returns {Promise<string>} The address.
   *
   * @example
   * // Get the address of the ethereum wallet's account at m/44'/60'/0'/0/3
   * const address = await wdk.getAddress("ethereum", 3);
   */
  async getAddress (blockchain, accountIndex) {
    const manager = await this._getWalletManager(blockchain)

    const account = await manager.getAccount(accountIndex)

    return await account.getAddress()
  }

  /**
   * Transfers a token to another address.
   *
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
   * @param {TransferOptions} options - The transfer's options.
   * @param {TransferConfig} [config] - If set, overrides the 'transferMaxFee' and 'paymasterToken' options defined in the manager configuration.
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
  async transfer (blockchain, accountIndex, options, config) {
    const manager = await this._getWalletManager(blockchain)

    const account = await manager.getAccount(accountIndex)

    return await account.transfer(options, config)
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @see {@link transfer}
   * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
   * @param {number} accountIndex - The index of the account to use (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
   * @param {TransferOptions} options - The transfer's options.
   * @param {TransferConfig} [config] - If set, overrides the 'transferMaxFee' and 'paymasterToken' options defined in the manager configuration.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   *
   * @example
   * // Quote the transfer of 1.0 USDT from the ethereum wallet's account at index 0 to another address
   * const quote = await wdk.quoteTransfer("ethereum", 0, {
   *     recipient: "0xabc...",
   *     token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
   *     amount: 1_000_000
   * });
   *
   * console.log("Gas cost in paymaster token:", quote.gasCost);
   */
  async quoteTransfer (blockchain, accountIndex, options, config) {
    const manager = await this._getWalletManager(blockchain)

    const account = await manager.getAccount(accountIndex)

    return await account.quoteTransfer(options, config)
  }

  async _getWalletManager (blockchain) {
    if (!Object.values(Blockchain).includes(blockchain)) {
      throw new Error(`Unsupported blockchain: ${blockchain}.`)
    }

    if (!this._wallets[blockchain]) {
      const seed = this._seed
      const config = this._config

      const seedPhrase = typeof seed === 'string' ? seed : (seed[blockchain] || seed)

      if (EVM_BLOCKCHAINS.includes(blockchain)) {
        const { default: WalletManagerEvm } = await import('@wdk/wallet-evm-erc-4337')

        this._wallets[blockchain] = new WalletManagerEvm(seedPhrase, config[blockchain])
      } else if (blockchain === 'ton') {
        const { default: WalletManagerTon } = await import('@wdk/wallet-ton-gasless')

        this._wallets.ton = new WalletManagerTon(seedPhrase, config.ton)
      } else if (blockchain === 'bitcoin') {
        const { default: WalletManagerBtc } = await import('@wdk/wallet-btc')

        this._wallets.bitcoin = new WalletManagerBtc(seedPhrase, config.bitcoin)
      } else if (blockchain === 'spark') {
        const { default: WalletManagerSpark } = await import('@wdk/wallet-spark')

        this._wallets.spark = new WalletManagerSpark(seedPhrase, config.spark)
      } else if (blockchain === 'tron') {
        const { default: WalletManagerTron } = await import('@wdk/wallet-tron')

        this._wallets.tron = new WalletManagerTron(seedPhrase, config.tron)
      }
    }

    return this._wallets[blockchain]
  }
}
