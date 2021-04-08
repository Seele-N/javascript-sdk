const sig = require('@tendermint/sig');
const _ = require('lodash');
const tx = require('../tx').tx;
const msg = require('../msg').msg;
const Hard = require('./hard').Hard;

const SEELE_PREFIX = 'seele';
const DERIVATION_PATH = "m/44'/513'/0'/0/0";
const DERIVATION_PATH_LEGACY = "m/44'/118'/0'/0/0";
const DEFAULT_FEE = { amount: [], gas: String(300000) }


const api = {
  txs: '/txs',
  nodeInfo: '/node_info',
  getBlock: '/blocks',
  getLatestBlock: '/blocks/latest',
  getLatestValidatorSet: '/validatorsets/latest',
  getValidatorSet: '/validatorsets/',
  getParamsPricefeed: '/pricefeed/parameters',
  getParamsAuction: '/auction/parameters',
  getParamsCDP: '/cdp/parameters',
  getParamsBEP3: '/bep3/parameters',
  getParamsIncentive: '/incentive/parameters',
  getParamsCommittee: '/committee/parameters',
  getParamsIssuance: '/issuance/parameters',
  getAccount: '/auth/accounts',
  getBalances: '/bank/balances',
  getSupply: '/supply/total',
};

/**
 * The Seele client.
 */
class SeeleClient {
  /**
   * @param {String} server Seele public url
   */
  constructor(server) {
    if (!server) {
      throw new Error('Seele server should not be null');
    }
    this.baseURI = server;
    this.broadcastMode = 'sync'; // default broadcast mode
    this.hard = new Hard(this);
  }

  /**
   * Initialize the client with the chain's ID. Asynchronous.
   * @return {Promise}
   */
  async initChain() {
    if (!this.chainID) {
      const res = await tx.getTx(api.nodeInfo, this.baseURI);
      this.chainID = _.get(res, 'data.node_info.network');
    }
    return this;
  }

  /**
   * Manually set the chain's ID
   * @param {String} chainID Seele chain ID
   */
  setChainID(chainID) {
    if (!chainID) {
      throw new Error('chainID cannot be undefined');
    }
    this.chainID = chainID;
    return this;
  }

  /**
   * Manually set the wallet's account number
   * @param {String} accNum Account number of the Seele address
   */
  setAccountNumber(accNum) {
    if (!accNum) {
      throw new Error('account number cannot be undefined');
    }
    this.accNum = String(accNum);
    return this;
  }

  /**
   * Set broadcast mode
   * @param {String} mode transaction broadcast mode
   */
  setBroadcastMode(mode) {
    if (!mode) {
      throw new Error('broadcast mode cannot be undefined');
    }
    if (mode != 'async' && mode != 'sync' && mode != 'block') {
      throw new Error(
        'invalid broadcast mode ',
        mode,
        ' - must be async, sync, or block'
      );
    }
    this.broadcastMode = String(mode);
    return this;
  }

  /**
   * Set the client's wallet which is used for signature generation
   * @param {String} mnemonic Seele address mnemonic
   * @param {String} password optional param for wallet password
   * @param {boolean} legacy optional param to use the legacy coin type
   * @return {Promise}
   */
  setWallet(
    mnemonic,
    password = '',
    legacy = false,
  ) {
    if (!mnemonic) {
      throw new Error('mnemonic cannot be undefined');
    }
    const derivationPath = legacy ? DERIVATION_PATH_LEGACY : DERIVATION_PATH
    this.wallet = sig.createWalletFromMnemonic(
      mnemonic,
      password,
      SEELE_PREFIX,
      derivationPath
    );
    return this;
  }

  /**
   * Load account number, sequence, and package with chain ID for signature
   * @param {String} sequence Seele address sequence
   * @return {Promise}
   */
  async prepareSignInfo(sequence) {
    let signInfo;
    if (sequence && this.accNum != null) {
      // Prepare signing info from manually set values
      signInfo = {
        chain_id: this.chainID,
        account_number: String(this.accNum),
        sequence: String(sequence),
      };
    } else {
      // Load meta data from the account's chain state
      const meta = await tx.loadMetaData(this.wallet.address, this.baseURI);
      // Select manually set values over automatically pulled values
      signInfo = {
        chain_id: this.chainID,
        account_number:
          this.accNum != null
            ? String(this.accNum)
            : String(meta.account_number),
        sequence: sequence ? String(sequence) : String(meta.sequence),
      };
    }
    return signInfo;
  }

  /**
   * Sends messages to the Seele blockchain
   * @param {Array} msgs an array of msgs to be sent
   * @param {Object} fee the transaction's fee that includes gas amount
   * @param {String} sequence account sequence
   * @return {Promise}
   */
  async sendTx(msgs, fee, sequence) {
    const rawTx = msg.cosmos.newStdTx(msgs, fee);
    const signInfo = await this.prepareSignInfo(sequence);
    const signedTx = tx.signTx(rawTx, signInfo, this.wallet);
    return await tx.broadcastTx(signedTx, this.baseURI, this.broadcastMode);
  }

  /***************************************************
   *                   Tendermint
   ***************************************************/
  /**
   * Get the latest block
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getLatestBlock(timeout = 2000) {
      const res = await tx.getTx(api.getLatestBlock, this.baseURI, timeout);
      if (res && res.data) {
        return res.data;
      }
  }

  /**
   * Get a block at a specific height
   * @param {Number} height the block's height
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getBlock(height, timeout = 2000) {
    const path = api.getBlock + '/' + String(height);
    const res = await tx.getTx(path, this.baseURI, timeout);
    if (res && res.data) {
      return res.data;
    }
  }

  /**
   * Get the latest set of validators
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getLatestValidatorSet(timeout = 2000) {
    const res = await tx.getTx(api.getLatestValidatorSet, this.baseURI, timeout);
    if (res && res.data) {
      return res.data;
    }
  }

  /**
   * Get a set of validators at a specific block height
   * @param {Number} height the block's height
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getValidatorSet(height, timeout = 2000) {
    const path = api.getValidatorSet + '/' + String(height);
    const res = await tx.getTx(path, this.baseURI, timeout);
    if (res && res.data) {
      return res.data;
    }
  }

  /**
   * Checks a transaction hash for on-chain results
   * @param {String} txHash the transaction's hash
   * @param {Number} timeout milliseconds until the transaction will be considered not found
   * @return {Promise}
   */
  async checkTxHash(txHash, timeout = 10000) {
    const path = api.txs + '/' + txHash;
    let res;

    // Query the chain for a transaction with this hash
    try {
      res = await tx.getTx(path, this.baseURI, timeout);
    } catch (e) {
      throw new Error(`tx not found: ${e}`);
    }

    // If the transaction is found, check that it was accepted by the chain
    try {
      if (_.get(res, 'data.code')) {
        throw new Error(
          `tx not accepted by chain: "${_.get(res, 'data.raw_log')}"`
        );
      }
     } catch (e) {
       console.log("\n" + e)
     }

    return res.data;
  }

  /***************************************************
   *                   Cosmos SDK
   ***************************************************/
  /**
   * Get information about an account
   * @param {String} address account to query
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getAccount(address, timeout = 2000) {
    const path = api.getAccount + '/' + address;
    const res = await tx.getTx(path, this.baseURI, timeout);
    if (res && res.data) {
      return res.data.result;
    }
  }

  /**
   * Get an account's balances
   * @param {String} address account to query
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getBalances(address, timeout = 2000) {
    const path = api.getBalances + '/' + address;
    const res = await tx.getTx(path, this.baseURI, timeout);
    if (res && res.data) {
      return res.data.result;
    }
  }

  /**
   * Get the total supply of coins on the chain
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getSupply(timeout = 2000) {
    const res = await tx.getTx(api.getSupply, this.baseURI, timeout);
    if (res && res.data) {
      return res.data.result;
    }
  }

  /**
   * Get the total supply of coins on the chain
   * @param {String} denom the name of the asset whose total supply will be queried
   * @param {Number} timeout request is attempted every 1000 milliseconds until millisecond timeout is reached
   * @return {Promise}
   */
  async getSupplyOf(denom, timeout = 2000) {
    const path = api.getSupply + '/' + denom;
    const res = await tx.getTx(path, this.baseURI, timeout);
    if (res && res.data) {
      return res.data.result;
    }
  }

  /**
   * Sends coins to an address
   * @param {String} recipient address that will receive coins
   * @param {String} coins amount of coins to send
   * @param {Object} fee optional fee consisting of { amount: [Coins], gas: String(Number) }
   * @param {String} sequence optional account sequence
   * @return {Promise}
   */
  async transfer(recipient, coins, fee = DEFAULT_FEE, sequence = null) {
    const msgSend = msg.cosmos.newMsgSend(this.wallet.address, recipient, coins);
    return await this.sendTx([msgSend], fee, sequence);
  }

}

module.exports.SeeleClient = SeeleClient;
