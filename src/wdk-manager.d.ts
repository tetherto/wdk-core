/**
 * Enumeration for all available blockchains.
 */
export type Blockchain = string;
export namespace Blockchain {
    let Ethereum: string;
    let Arbitrum: string;
    let Polygon: string;
    let Ton: string;
    let Bitcoin: string;
    let Spark: string;
    let Tron: string;
}
export default class WdkManager {
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
    static getRandomSeedPhrase(): string;
    /**
     * Checks if a seed phrase is valid.
     *
     * @param {string} seed - The seed phrase.
     * @returns {boolean} True if the seed phrase is valid.
     */
    static isValidSeedPhrase(seed: string): boolean;
    /**
     * Creates a new wallet development kit manager.
     *
     * @param {string | Seeds} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase to use for
     *                                all blockchains, or an object mapping each blockchain to a different seed phrase.
     * @param {WdkConfig} config - The configuration for each blockchain.
     */
    constructor(seed: string | Seeds, config: WdkConfig);
    _seed: any;
    _config: WdkConfig;
    _wallets: {};
    _cache: {};
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
    getAccount(blockchain: Blockchain, index?: number): Promise<IWalletAccount>;
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
    getAccountByPath(blockchain: Blockchain, path: string): Promise<IWalletAccount>;
    /**
     * Returns the current fee rates for a specific blockchain.
     *
     * @param {Blockchain} blockchain - A blockchain identifier (e.g., "ethereum").
     * @returns {Promise<{ normal: number, fast: number }>} The fee rates (in weis).
     */
    getFeeRates(blockchain: Blockchain): Promise<{
        normal: number;
        fast: number;
    }>;
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
    getAddress(blockchain: Blockchain, accountIndex: number): Promise<string>;
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
    transfer(blockchain: Blockchain, accountIndex: number, options: TransferOptions, config?: TransferConfig): Promise<TransferResult>;
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
    quoteTransfer(blockchain: Blockchain, accountIndex: number, options: TransferOptions, config?: TransferConfig): Promise<Omit<TransferResult, "hash">>;
    _getWalletManager(blockchain: any): Promise<any>;
}
