import {BigNumber, Contract, ethers, Wallet, utils} from 'ethers';
import type {Env} from './types';
import {contracts, chainId} from './contracts.json';
import {DO} from './DO';
import {
  TransactionInvalidMissingFields,
  NoReveal,
  AlreadyPending,
  NotEnoughBalance,
  NotRegistered,
  NotAuthorized,
  InvalidNonce,
  NoDelegateRegistered,
  InvalidDelegate,
  InvalidFeesScheduleSubmission,
} from './errors';
import {xyToLocation, createResponse} from './utils';

const {verifyMessage} = utils;

let defaultFinality = 12;
if (chainId === '1337') {
  defaultFinality = 3;
} else if (chainId === '31337') {
  defaultFinality = 2;
}

function isAuthorized(address: string, message: string, signature: string): boolean {
  let addressFromSignature;
  try {
    addressFromSignature = verifyMessage(message, signature);
  } catch (e) {
    return false;
  }
  return address.toLowerCase() == addressFromSignature.toLowerCase();
}

// needed because of : https://github.com/cloudflare/durable-objects-typescript-rollup-esm/issues/3
type State = DurableObjectState & {blockConcurrencyWhile: (func: () => Promise<void>) => void};

type TransactionInfo = {hash: string; nonce: number; broadcastTime: number; maxFeePerGasUsed: string};

// Data sent by frontend to request a reveal transaction to be broadcasted at reveal time (startTime + duration)
// startTime is the expected startTime, could be off if the send transaction is still pending.
// duration could technically be computed by backend, but could as well be sent by frontend. Just need to make sure it is accurate
// TODO add sendTXInfo : {hash: string; nonce: number} // so that queue can remove the reveal if that sendTXInfo is never mined.
// - This would work because the secret (And the fleetID, which is the hash) is generated from nonce and if a new tx replace it and is confirmed but the fleetID has not been recorded, we know that that particular fleet is gone forever
// - this would need the sendTxSender address too to compare nonce
type Reveal = {
  player: string;
  fleetID: string;
  secret: string;
  from: {x: number; y: number};
  to: {x: number; y: number};
  distance: number;
  startTime: number; // this is the expected startTime, needed as sendTx could be pending
  duration: number; // could technically recompute it from spaceInfo // TODO ? if so move duration in RevealData type
};

type RevealSubmission = Reveal & {delegate?: string; signature: string; nonceMsTimestamp: number};

type MaxFeesSchedule = [
  {maxFeePerGas: string; delay: number},
  {maxFeePerGas: string; delay: number},
  {maxFeePerGas: string; delay: number}
];

// Data for each account
type AccountData = {
  nonceMsTimestamp: number;
  paid: string; // amount of ETH deposited minus amout used (by mined transactions)
  spending: string; // amount reserved for pending reveals
  delegate?: string; // TODO array or reverse lookup ?
  maxFeesSchedule: MaxFeesSchedule; // an array for of maxFeePerGas to use depending on delay for new reveals
};

// The data store per reveal requested
type RevealData = RevealSubmission & {
  sendConfirmed: boolean; // flag indicating whether the send transaction has been confirmed and startTime is now validated
  retries: number; // whenever the tx is pushed back for later because it cannot be sent (cannot fetch startTime for example, meaning the fleet do not exist)
  maxFeesSchedule: MaxFeesSchedule; // an array for of maxFeePerGas to use depending on delay for this reveal
};

// Data stored when a transaction is broadcasted
type PendingTransactionData = RevealData & {tx: TransactionInfo};

// global index counter to ensure ordering of tx but also ensure their pendingID is unique
type TransactionsCounter = {
  nextIndex: number;
};

type RegistrationSubmission = {
  player: string; // player to register
  delegate: string; // delegate allowed to perform submission on behalf of the player
  nonceMsTimestamp: number; // handy mechanism to push update without the need to fetch nonce first
  signature: string; // signature for the registration data
};

type FeeScheduleSubmission = {
  player: string; // player for which we want to update the feeSchedule
  delegate?: string; // submitted by delegate
  maxFeesSchedule: MaxFeesSchedule; // an array for of maxFeePerGas to use depending on delay for new reveals
  nonceMsTimestamp: number; // handy mechanism to push update without the need to fetch nonce first
  signature: string; // signature for the new feeschedule data
};

// Data stored for fleetID to ensure only one fleetID is being queued across the queue.
// it also store the tx info
type ListData = {
  queueID?: string;
  pendingID?: string;
};

type SyncData = {
  blockHash: string;
  blockNumber: number;
};

const gwei = BigNumber.from('1000000000');
const defaultMaxFeePerGas = gwei.mul(100);
// the default fee schedule for new user registration
const defaultMaxFeesSchedule: MaxFeesSchedule = [
  {maxFeePerGas: defaultMaxFeePerGas.toString(), delay: 0},
  {maxFeePerGas: defaultMaxFeePerGas.toString(), delay: 0},
  {maxFeePerGas: defaultMaxFeePerGas.toString(), delay: 0},
];

// maximum gas consumed for the reveal tx // TODO check its actual value, as we modify the contract
// TODO specify it as part of the reveal submission (if the system was fully generic, then it make sense to add it)
const revealMaxGasEstimate = BigNumber.from(200000);

const RETRY_MAX_PERIOD = 1 * 60 * 60; // 1 hour?
function retryPeriod(duration: number): number {
  return Math.min(RETRY_MAX_PERIOD, duration);
}

function lexicographicNumber12(num: number): string {
  return num.toString().padStart(12, '0');
}
function lexicographicNumber8(num: number): string {
  return num.toString().padStart(8, '0');
}

function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

function getMaxFeeAllowed(maxFees: MaxFeesSchedule): BigNumber {
  return maxFees.reduce(
    (prev, curr) => (prev.gt(curr.maxFeePerGas) ? prev : BigNumber.from(curr.maxFeePerGas)),
    BigNumber.from(0)
  );
}

function getMaxFeeFromArray(array: MaxFeesSchedule, delay: number): BigNumber {
  let maxFeePerGas = BigNumber.from(array[0].maxFeePerGas);
  for (let i = 0; i < array.length; i++) {
    const elem = array[array.length - i - 1];
    if (elem.delay <= delay) {
      return BigNumber.from(elem.maxFeePerGas);
    }
  }
  return maxFeePerGas;
}

function checkSubmission(data: RevealSubmission): {errorResponse?: Response; revealData?: RevealSubmission} {
  if (
    data.duration &&
    data.secret &&
    data.fleetID &&
    data.to &&
    data.to.x !== undefined &&
    data.to.y !== undefined &&
    data.startTime &&
    data.player &&
    data.distance &&
    data.from &&
    data.from.x !== undefined &&
    data.from.y !== undefined &&
    data.signature &&
    data.nonceMsTimestamp
  ) {
    return {revealData: data};
  } else {
    return {errorResponse: TransactionInvalidMissingFields()};
  }
}

function checkFeeScheduleSubmission(data: FeeScheduleSubmission): {errorResponse?: Response} {
  if (data.maxFeesSchedule.length === 3 && data.maxFeesSchedule[0].delay === 0) {
    return {};
  } else {
    return {errorResponse: InvalidFeesScheduleSubmission()};
  }
}

export class RevealQueue extends DO {
  provider: ethers.providers.JsonRpcProvider;
  wallet: ethers.Wallet;
  outerspaceContract: ethers.Contract;
  paymentContract: ethers.Contract;
  finality: number;

  constructor(state: State, env: Env) {
    super(state, env);
    this.provider = new ethers.providers.JsonRpcProvider(env.ETHEREUM_NODE);
    this.wallet = new Wallet(this.env.PRIVATE_KEY, this.provider);
    this.outerspaceContract = new Contract(contracts.OuterSpace.address, contracts.OuterSpace.abi, this.wallet);
    this.paymentContract = new Contract(contracts.PaymentGateway.address, contracts.PaymentGateway.abi, this.wallet);
    this.finality = env.FINALITY ? parseInt(env.FINALITY) : defaultFinality;
  }

  async register(path: string[], registrationSubmission: RegistrationSubmission): Promise<Response> {
    const timestampMs = Math.floor(Date.now());
    const player = registrationSubmission.player.toLowerCase();
    const accountID = `account_${player}`;
    let account = await this.state.storage.get<AccountData | undefined>(accountID);
    if (!account) {
      account = {
        spending: '0',
        paid: '0',
        nonceMsTimestamp: 0,
        maxFeesSchedule: defaultMaxFeesSchedule,
      };
    }
    if (
      registrationSubmission.nonceMsTimestamp <= account.nonceMsTimestamp ||
      registrationSubmission.nonceMsTimestamp > timestampMs
    ) {
      return InvalidNonce();
    }
    const authorized = isAuthorized(
      player,
      `conquest-agent-service: register ${registrationSubmission.delegate.toLowerCase()} as delegate for ${player} (nonce: ${
        registrationSubmission.nonceMsTimestamp
      })`,
      registrationSubmission.signature
    );
    // console.log({player, authorized, signature: registrationSubmission.signature});
    if (!authorized) {
      return NotAuthorized();
    }

    account.delegate = registrationSubmission.delegate.toLowerCase();
    account.nonceMsTimestamp = registrationSubmission.nonceMsTimestamp;
    this.state.storage.put<AccountData>(accountID, account);

    return createResponse({success: true});
  }

  async setMaxFeePerGasSchedule(path: string, feeScheduleSubmission: FeeScheduleSubmission): Promise<Response> {
    const {errorResponse} = checkFeeScheduleSubmission(feeScheduleSubmission);
    if (errorResponse) {
      return errorResponse;
    }

    const timestampMs = Math.floor(Date.now());
    const player = feeScheduleSubmission.player.toLowerCase();
    const accountID = `account_${player}`;
    let account = await this.state.storage.get<AccountData | undefined>(accountID);
    if (!account) {
      account = {
        spending: '0',
        paid: '0',
        nonceMsTimestamp: 0,
        maxFeesSchedule: defaultMaxFeesSchedule,
      };
    }
    if (
      feeScheduleSubmission.nonceMsTimestamp <= account.nonceMsTimestamp ||
      feeScheduleSubmission.nonceMsTimestamp > timestampMs
    ) {
      return InvalidNonce();
    }

    if (feeScheduleSubmission.delegate) {
      if (!account.delegate) {
        return NoDelegateRegistered();
      }
      if (feeScheduleSubmission.delegate.toLowerCase() !== account.delegate.toLowerCase()) {
        return InvalidDelegate();
      }
    }

    const feesScheduleString = feeScheduleSubmission.maxFeesSchedule
      .map((v) => '' + v.delay + ':' + v.maxFeePerGas + ':')
      .join(',');
    const scheduleMessageString = `setMaxFeePerGasSchedule:${player}:${feesScheduleString}:${feeScheduleSubmission.nonceMsTimestamp}`;
    const authorized = isAuthorized(
      feeScheduleSubmission.delegate ? account.delegate : player,
      scheduleMessageString,
      feeScheduleSubmission.signature
    );
    console.log({
      scheduleMessageString,
      player,
      delegate: account.delegate,
      authorized,
      signature: feeScheduleSubmission.signature,
    });
    if (!authorized) {
      return NotAuthorized();
    }

    account.maxFeesSchedule = feeScheduleSubmission.maxFeesSchedule;
    this.state.storage.put<AccountData>(accountID, account);

    return createResponse({success: true});
  }

  async queueReveal(path: string[], revealSubmission: RevealSubmission): Promise<Response> {
    const {errorResponse, revealData} = checkSubmission(revealSubmission);
    if (errorResponse) {
      return errorResponse;
    } else if (!revealData) {
      return NoReveal();
    }

    const timestampMs = Math.floor(Date.now());

    const accountID = `account_${revealSubmission.player.toLowerCase()}`;
    let account = await this.state.storage.get<AccountData | undefined>(accountID);
    if (!account) {
      account = {paid: '0', spending: '0', nonceMsTimestamp: 0, maxFeesSchedule: defaultMaxFeesSchedule};
    }
    const maxFeeAllowed = getMaxFeeAllowed(account.maxFeesSchedule);
    const minimumBalance = maxFeeAllowed.mul(revealMaxGasEstimate);
    const reveal = {...revealData, retries: 0, sendConfirmed: false, maxFeesSchedule: account.maxFeesSchedule};

    if (
      revealSubmission.nonceMsTimestamp <= account.nonceMsTimestamp ||
      revealSubmission.nonceMsTimestamp > timestampMs
    ) {
      return InvalidNonce();
    }

    if (revealSubmission.delegate) {
      if (!account.delegate) {
        return NoDelegateRegistered();
      }
      if (revealSubmission.delegate.toLowerCase() !== account.delegate.toLowerCase()) {
        return InvalidDelegate();
      }
    }

    const {player, fleetID, secret, from, to, distance, startTime, duration} = revealSubmission;

    const queueMessageString = `queue:${player}:${fleetID}:${secret}:${from.x}:${from.y}:${to.x}:${to.y}:${distance}:${startTime}:${duration}:${revealSubmission.nonceMsTimestamp}`;
    const authorized = isAuthorized(
      revealSubmission.delegate ? account.delegate : player,
      queueMessageString,
      revealSubmission.signature
    );
    console.log({
      queueMessageString,
      player,
      delegate: account.delegate,
      authorized,
      signature: revealSubmission.signature,
    });
    if (!authorized) {
      return NotAuthorized();
    }

    let balance = BigNumber.from(account.paid).sub(account.spending);
    if (balance.lt(minimumBalance)) {
      //|| !account.delegate) {
      balance = await this._fetchExtraBalanceFromLogs(balance, player.toLowerCase());
      if (balance.lt(minimumBalance)) {
        return NotEnoughBalance();
      }
    }

    const revealID = `l_${reveal.fleetID}`;
    const broadcastingTime = reveal.startTime + reveal.duration;
    const queueID = `q_${lexicographicNumber12(broadcastingTime)}_${reveal.fleetID}}`;

    const existing = await this.state.storage.get<ListData | undefined>(revealID);
    if (existing) {
      if (existing.pendingID) {
        // TODO what should we do here, for now reject
        // the transaction is already on its way and unless the initial data was wrong, the tx is going to go through and succeed (if sent/mined in time)
        // could add a FORCE option ?
        return AlreadyPending();
      } else if (!existing.queueID) {
        // impossible
      } else if (queueID != existing.queueID) {
        this.state.storage.delete(existing.queueID);
        // this.state.storage.delete(revealID); // no need as it will be overwritten below
      }
    }

    let accountRefected = await this.state.storage.get<AccountData | undefined>(accountID);
    if (!accountRefected) {
      accountRefected = {paid: '0', spending: '0', nonceMsTimestamp: 0, maxFeesSchedule: defaultMaxFeesSchedule};
    }
    const spending = BigNumber.from(accountRefected.spending).add(minimumBalance);
    accountRefected.spending = spending.toString();

    this.state.storage.put<AccountData>(accountID, accountRefected);
    this.state.storage.put<RevealData>(queueID, reveal);
    this.state.storage.put<ListData>(revealID, {queueID});
    return createResponse({queueID});
  }

  async execute(path: string[]): Promise<Response> {
    const timestamp = getTimestamp();
    // TODO test limit, is 10 good enough ? this will depends on exec time and CRON period and number of tx submitted
    const limit = 10;
    const reveals = (await this.state.storage.list({prefix: `q_`, limit})) as Map<string, RevealData>;
    for (const revealEntry of reveals.entries()) {
      const reveal = revealEntry[1];
      const queueID = revealEntry[0];
      const revealTime = reveal.startTime + reveal.duration;
      if (revealTime <= timestamp) {
        console.log(`executing ${queueID}...`);
        await this._executeReveal(queueID, reveal);
      } else {
        console.log(
          `skip reveal (${queueID}) because not yet time (${reveal.startTime} + ${reveal.duration} = ${revealTime}) > ${timestamp}`
        );
      }
    }

    return createResponse({success: true});
  }

  async checkPendingTransactions(path: string[]): Promise<Response> {
    // TODO test limit, is 10 good enough ? this will depends on exec time and CRON period and number of tx submitted
    const limit = 10;
    const txs = (await this.state.storage.list({prefix: `pending_`, limit})) as Map<string, PendingTransactionData>;
    for (const txEntry of txs.entries()) {
      const pendingID = txEntry[0];
      const pendingReveal = txEntry[1];
      await this._checkPendingTransaction(pendingID, pendingReveal);
      // TODO check pending transactions, remove confirmed one, increase gas if queue not moving
      // nonce can be rebalanced too if needed ?
    }

    return createResponse({success: true});
  }

  async deleteAll(path: string[]): Promise<Response> {
    if (path[0] === 'fall-sunshine-autumn-tree') {
      this.state.storage.deleteAll();
      return createResponse({success: true});
    } else {
      this.state.storage.deleteAll();
      return createResponse({success: false});
    }
  }

  async account(path: string[]): Promise<Response> {
    const player = path[0]?.toLowerCase();
    const accountID = `account_${player}`;
    const accountData = await this.state.storage.get<AccountData | undefined>(accountID);
    if (accountData) {
      const maxFeeAllowed = getMaxFeeAllowed(accountData.maxFeesSchedule);
      const minimumBalance = maxFeeAllowed.mul(revealMaxGasEstimate);
      let balance = BigNumber.from(accountData.paid).sub(accountData.spending);
      if (balance.lt(minimumBalance)) {
        balance = await this._fetchExtraBalanceFromLogs(balance, player);
      }
      return createResponse({
        account: {
          ...accountData,
          balance: balance.toString(),
          requireTopUp: balance.lt(minimumBalance),
          minimumBalance: minimumBalance.toString(),
        },
      });
    }
    return createResponse({account: null});
  }

  async getTransactionInfo(path: string[]): Promise<Response> {
    const revealID = `l_${path[0]}`;
    const listData = await this.state.storage.get<ListData | undefined>(revealID);
    if (listData && listData.pendingID) {
      const pendingTransaction = await this.state.storage.get<PendingTransactionData | undefined>(listData.pendingID);
      if (pendingTransaction) {
        return createResponse({tx: pendingTransaction.tx});
      }
    }
    return createResponse({tx: null});
  }

  async getPendingTransactions(path: string[]): Promise<Response> {
    const limit = 1000;
    const txEntries = (await this.state.storage.list({prefix: `pending_`, limit})) as Map<
      string,
      PendingTransactionData
    >;
    const txs = {};
    for (const txEntry of txEntries.entries()) {
      const tx = txEntry[1];
      const txID = txEntry[0];
      txs[txID] = tx;
    }
    return createResponse({txs, success: true});
  }

  async getQueue(path: string[]): Promise<Response> {
    const limit = 1000;
    const reveals = (await this.state.storage.list({prefix: `q_`, limit})) as Map<string, RevealData>;
    const queue = {};
    for (const revealEntry of reveals.entries()) {
      const reveal = revealEntry[1];
      const queueID = revealEntry[0];
      queue[queueID] = {
        fleetID: reveal.fleetID,
        from: reveal.from,
        player: reveal.player,
        retries: reveal.retries,
        startTime: reveal.startTime,
        sendConfirmed: reveal.sendConfirmed,
      };
    }
    return createResponse({queue});
  }

  async syncAccountBalances(path: string[]): Promise<Response> {
    const currentBlockNumber = await this.provider.getBlockNumber();
    const toBlockNumber = Math.max(0, currentBlockNumber - this.finality); // TODO configure finality
    const toBlockObject = await this.provider.getBlock(toBlockNumber);
    // const toBlock = toBlockObject.hash;

    let lastSync = await this.state.storage.get<SyncData | undefined>('sync');
    if (!lastSync) {
      lastSync = {blockNumber: 0, blockHash: ''};
    }

    // console.log({lastSync});

    // if there is no new block, no point processing, this will just handle reorg for no benefit
    if (toBlockNumber <= lastSync.blockNumber) {
      return createResponse('no new block to fetch'); // TODO ?
    }
    const fromBlock = lastSync.blockNumber + 1;

    const accountsToUpdate: {[account: string]: {balanceUpdate: BigNumber}} = {};
    const events = await this.paymentContract.queryFilter(
      this.paymentContract.filters.Payment(),
      fromBlock,
      toBlockNumber
    );

    // console.log({events});
    for (const event of events) {
      if (event.removed) {
        continue; //ignore removed
      }
      if (event.args) {
        // console.log(event.args);
        const payer = event.args.payer.toLowerCase();
        const accountUpdate = (accountsToUpdate[payer] = accountsToUpdate[payer] || {balanceUpdate: BigNumber.from(0)});
        if (event.args.refund) {
          accountUpdate.balanceUpdate = accountUpdate.balanceUpdate.sub(event.args.amount);
        } else {
          // if (event.args.setDelegate.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
          //     account.delegate = event.args.setDelegate.toLowerCase();
          // }
          accountUpdate.balanceUpdate = accountUpdate.balanceUpdate.add(event.args.amount);
        }
      }
    }
    let lastSyncRefetched = await this.state.storage.get<SyncData | undefined>('sync');
    if (!lastSyncRefetched) {
      lastSyncRefetched = {blockHash: '', blockNumber: 0};
    }
    if (lastSyncRefetched.blockHash !== lastSync.blockHash) {
      // console.log(`got already updated ?`)
      return createResponse(`got already updated ?`); // TODO ?
    }

    const accountAddresses = Object.keys(accountsToUpdate);
    for (const accountAddress of accountAddresses) {
      const accountUpdate = accountsToUpdate[accountAddress];
      let currentAccountState = await this.state.storage.get<AccountData | undefined>(`account_${accountAddress}`);
      if (!currentAccountState) {
        currentAccountState = {paid: '0', spending: '0', nonceMsTimestamp: 0, maxFeesSchedule: defaultMaxFeesSchedule};
      }
      this.state.storage.put<AccountData>(`account_${accountAddress}`, {
        paid: accountUpdate.balanceUpdate.add(currentAccountState.paid).toString(),
        spending: currentAccountState.spending,
        nonceMsTimestamp: currentAccountState.nonceMsTimestamp,
        delegate: currentAccountState.delegate,
        maxFeesSchedule: currentAccountState.maxFeesSchedule,
      });
      console.log(`${accountAddress} updated...`);
    }
    lastSyncRefetched.blockHash = toBlockObject.hash;
    lastSyncRefetched.blockNumber = toBlockNumber;
    this.state.storage.put<SyncData>('sync', lastSyncRefetched);

    // console.log({lastSyncRefetched});
    return createResponse({success: true});
  }

  private async _fetchExtraBalanceFromLogs(balance: BigNumber, player: string): Promise<BigNumber> {
    let lastSync = await this.state.storage.get<SyncData | undefined>('sync');
    if (!lastSync) {
      lastSync = {blockNumber: 0, blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000'};
    }

    // fetch latest events; (not finalized)
    const filter = this.paymentContract.filters.Payment(player);
    const recentEvents = await this.paymentContract.queryFilter(filter, lastSync.blockNumber, 'latest');
    for (const event of recentEvents) {
      if (event.args) {
        if (event.args.refund) {
          balance = balance.sub(event.args.amount);
        } else {
          balance = balance.add(event.args.amount);
        }
      }
    }
    return balance;
  }

  private async _executeReveal(queueID: string, reveal: RevealData) {
    const maxFeeAllowed = getMaxFeeAllowed(reveal.maxFeesSchedule);
    const minimumBalance = maxFeeAllowed.mul(revealMaxGasEstimate);
    const account = await this.state.storage.get<AccountData | undefined>(`account_${reveal.player}`);
    if (!account || BigNumber.from(account.paid).lt(minimumBalance)) {
      if (!account) {
        console.log(`no account registered for ${reveal.player}`);
      } else {
        console.log(`not enough fund for ${reveal.player}`);
      }

      return;
      // TODO delete ? or push it and increase retries count
    }

    const revealID = `l_${reveal.fleetID}`;
    const timestamp = getTimestamp();
    let change = false;
    if (!reveal.sendConfirmed) {
      // TODO use reveal.sendTxHash will aloow to get confirmations, need to check if fleet exist
      const actualStartTime = await this._fetchStartTime(reveal);
      // refetch queueID in case it was deleted / moved
      const revealRefetched = await this.state.storage.get<RevealData | undefined>(queueID);
      if (!revealRefetched) {
        return;
      } else {
        reveal = revealRefetched;
      }

      if (!actualStartTime) {
        // not found
        reveal.startTime = timestamp + retryPeriod(reveal.duration);
        reveal.retries++;
        change = true;
      } else {
        reveal.sendConfirmed = true;
        reveal.startTime = actualStartTime;
        change = true;
      }
    }

    const newBroadcastingTime = reveal.startTime + reveal.duration;
    const newQueueID = `q_${lexicographicNumber12(newBroadcastingTime)}_${reveal.fleetID}`;
    if (reveal.sendConfirmed) {
      if (newBroadcastingTime <= timestamp) {
        let transactionsCounter = await this.state.storage.get<TransactionsCounter | undefined>(`pending`);
        if (!transactionsCounter) {
          const transactionCount = await this.wallet.getTransactionCount();
          transactionsCounter = await this.state.storage.get<TransactionsCounter | undefined>(`pending`);
          if (!transactionsCounter) {
            transactionsCounter = {nextIndex: transactionCount}; // ensure no duplicate id in the bucket even if exact same boradcastingTime
            await this.state.storage.put<TransactionsCounter>('pending', transactionsCounter);
          }
        }

        const currentMaxFee = getMaxFeeFromArray(reveal.maxFeesSchedule, timestamp - newBroadcastingTime);

        const {tx, error} = await this._submitTransaction(reveal, {
          expectedNonce: transactionsCounter.nextIndex,
          maxFeePerGas: currentMaxFee,
        }); // first save before broadcast ? // or catch "tx already submitted error"
        if (error) {
          // TODO
          return;
        } else if (!tx) {
          // impossible
          return;
        }
        const listData = await this.state.storage.get<ListData | undefined>(revealID);
        if (!listData) {
          // TODO what to do here. this should not happen
          return;
        }
        if (listData.pendingID) {
          // Already pending
          // TODO what to do here ?
        } else if (listData.queueID) {
          queueID = listData.queueID;
        }

        // TODO
        // transactionCounter should not be changed in between
        // if it was, one tx would override another
        // we could save both somehow?
        // should not happen as the only submitter is the CRON job, leave it for now

        const pendingID = `pending_${lexicographicNumber8(transactionsCounter.nextIndex)}`;
        this.state.storage.put<ListData>(revealID, {pendingID});
        this.state.storage.put<PendingTransactionData>(pendingID, {...reveal, tx});

        transactionsCounter.nextIndex++;
        this.state.storage.put<TransactionsCounter>(`pending`, transactionsCounter);
        this.state.storage.delete(queueID);
      } else {
        if (change) {
          if (newQueueID !== queueID) {
            this.state.storage.delete(queueID);
            this.state.storage.put<RevealData>(newQueueID, reveal);
          } else {
            this.state.storage.put<RevealData>(queueID, reveal);
          }
        }
      }
    } else {
      if (newQueueID !== queueID) {
        this.state.storage.delete(queueID);
        this.state.storage.put<RevealData>(newQueueID, reveal);
      } else {
        this.state.storage.put<RevealData>(queueID, reveal);
      }
    }
  }

  async _submitTransaction(
    reveal: RevealData,
    options: {expectedNonce?: number; forceNonce?: number; maxFeePerGas: BigNumber}
  ): Promise<{
    tx?: {hash: string; nonce: number; broadcastTime: number; maxFeePerGasUsed: string};
    error?: {message: string; code: number};
  }> {
    try {
      let nonce: number | undefined;
      if (options.forceNonce) {
        nonce = options.forceNonce;
      }
      if (options.expectedNonce) {
        if (!nonce) {
          nonce = await this.wallet.getTransactionCount();
        }
        if (nonce !== options.expectedNonce) {
          return {error: {message: `nonce not matching, expected ${options.expectedNonce}, got ${nonce}`, code: 5501}};
        }
      }

      let maxPriorityFeePerGas = undefined;
      // let feeHistory:
      // | {
      //     baseFeePerGas: string[];
      //     gasUsedRatio?: number[]; // not documented on https://playground.open-rpc.org/?schemaUrl=https://raw.githubusercontent.com/ethereum/eth1.0-apis/assembled-spec/openrpc.json&uiSchema%5BappBar%5D%5Bui:splitView%5D=false&uiSchema%5BappBar%5D%5Bui:input%5D=false&uiSchema%5BappBar%5D%5Bui:examplesDropdown%5D=false
      //     oldestBlock: number;
      //     reward: string[][];
      //   }
      // | undefined = undefined;
      // try {
      //   // TODO check what best to do to ensure we do not unecessarely high maxPriorityFeePerGas
      //   // in worst case, we could continue and try catch like below catching specific error message
      //   feeHistory = await this.provider.send('eth_feeHistory', [
      //     1,
      //     'latest',
      //     [100],
      //   ]);
      // } catch (e) {}
      // if (feeHistory) {
      //   if (options.maxFeePerGas.lt(feeHistory.reward[0][0])) {
      //     maxPriorityFeePerGas = options.maxFeePerGas;
      //   }
      //   console.log(feeHistory.reward);
      // } else {
      //   console.log('no feeHistory')
      // }

      let tx;
      try {
        tx = await this.outerspaceContract.resolveFleet(
          reveal.fleetID,
          xyToLocation(reveal.from.x, reveal.from.y),
          xyToLocation(reveal.to.x, reveal.to.y),
          reveal.distance,
          reveal.secret,
          {
            nonce,
            maxFeePerGas: options.maxFeePerGas,
            maxPriorityFeePerGas,
          }
        );
      } catch (e) {
        // TODO investigate error code for it ?
        if (e.message && e.message.indexOf && e.message.indexOf(' is bigger than maxFeePerGas ') !== -1) {
          console.log('RETRYING with maxPriorityFeePerGas = maxFeePerGas');
          tx = await this.outerspaceContract.resolveFleet(
            reveal.fleetID,
            xyToLocation(reveal.from.x, reveal.from.y),
            xyToLocation(reveal.to.x, reveal.to.y),
            reveal.distance,
            reveal.secret,
            {
              nonce,
              maxFeePerGas: options.maxFeePerGas,
              maxPriorityFeePerGas: options.maxFeePerGas,
            }
          );
        } else {
          throw e;
        }
      }
      return {
        tx: {
          hash: tx.hash,
          nonce: tx.nonce,
          broadcastTime: getTimestamp(),
          maxFeePerGasUsed: options.maxFeePerGas.toString(),
        },
      };
    } catch (e) {
      if (e.message && e.message.indexOf && e.message.indexOf(`is less than the block's baseFeePerGas`) !== -1) {
        // TODO ? push down the queue to not bother others...
      }
      console.error(e.message);
      // console.error(e);
      const error = e as {message?: string};
      return {error: {message: error.message || 'error caught: ' + e, code: 5502}};
    }
  }

  async _checkPendingTransaction(pendingID: string, pendingReveal: PendingTransactionData): Promise<void> {
    const transaction = await this.provider.getTransaction(pendingReveal.tx.hash);
    if (!transaction || transaction.confirmations === 0) {
      const lastMaxFeeUsed = pendingReveal.tx.maxFeePerGasUsed;
      const broadcastingTime = pendingReveal.startTime + pendingReveal.duration;
      const currentMaxFee = getMaxFeeFromArray(pendingReveal.maxFeesSchedule, getTimestamp() - broadcastingTime);
      if (!transaction || currentMaxFee.gt(lastMaxFeeUsed)) {
        console.log(
          `broadcast reveal tx for fleet: ${pendingReveal.fleetID} ${
            transaction ? 'with new fee' : 'again as it was lost'
          } ... `
        );
        const {error, tx} = await this._submitTransaction(pendingReveal, {
          forceNonce: pendingReveal.tx.nonce,
          maxFeePerGas: currentMaxFee,
        });
        if (error) {
          // TODO
          return;
        } else if (!tx) {
          // impossible
          return;
        }
        pendingReveal.tx = tx;
        this.state.storage.put<PendingTransactionData>(pendingID, pendingReveal);
      }
    } else if (transaction.confirmations >= 12) {
      const txReceipt = await this.provider.getTransactionReceipt(pendingReveal.tx.hash);
      const accountID = `account_${pendingReveal.player.toLowerCase()}`;
      const accountData = await this.state.storage.get<AccountData | undefined>(accountID);
      if (accountData) {
        const maxFeeAllowed = getMaxFeeAllowed(pendingReveal.maxFeesSchedule);
        const minimumBalance = maxFeeAllowed.mul(revealMaxGasEstimate);
        let gasCost = minimumBalance;
        if (txReceipt.gasUsed && txReceipt.effectiveGasPrice) {
          gasCost = txReceipt.gasUsed?.mul(txReceipt.effectiveGasPrice);
        }
        const paid = BigNumber.from((await accountData).paid).sub(gasCost);
        const spending = BigNumber.from((await accountData).spending).sub(minimumBalance);
        accountData.paid = paid.toString();
        accountData.spending = spending.toString();
        this.state.storage.put<AccountData>(accountID, accountData);
      } else {
        console.error(`weird, accountData do not exist anymore`); // TODO handle it
      }
      this.state.storage.delete(pendingID);
      const revealID = `l_${pendingReveal.fleetID}`;
      this.state.storage.delete(revealID);
    }
  }

  async _fetchStartTime(reveal: RevealData): Promise<number | undefined> {
    // const tx = await this.provider.getTransactionReceipt(reveal.sendTxHash);
    // if (!tx) {
    //     const nonce = await this.provider.getTransactionCount(reveal.sendTxSender);
    // }
    const block = await this.provider.getBlock('latest');
    const lastestBlockFinalized = Math.max(0, block.number - this.finality);
    const fleet = await this.outerspaceContract.getFleet(reveal.fleetID, '0', {blockTag: lastestBlockFinalized});
    if (fleet.owner !== '0x0000000000000000000000000000000000000000') {
      // quantity >0 means already submitted , should remove them ?
      return fleet.launchTime;
    } else {
      // console.log(`cannot get startTIme for fleet ${reveal.fleetID} ${fleet.launchTime} ${fleet.quantity} ${lastestBlockFinalized} ${block.number}`)
      return undefined;
    }
  }
}
