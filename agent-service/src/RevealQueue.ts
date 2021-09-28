import { BigNumber, Contract, ethers, Wallet, utils } from "ethers";
import type {Env} from './types';
import {contracts, chainId} from './contracts.json';
import { DO } from "./DO";
import { TransactionInvalidMissingFields, NoReveal, AlreadyPending, NotEnoughBalance, NotRegistered, NotAuthorized, InvalidNonce, NoDelegateRegistered, InvalidDelegate } from "./errors";
import {xyToLocation, createResponse} from './utils';

const { parseEther, verifyMessage } = utils;

let defaultFinality = 12;
if (chainId === "1337") {
  defaultFinality = 3;
} else if (chainId === "31337") {
  defaultFinality = 2;
}


function isAuthorized(
    address: string,
    message: string,
    signature: string
  ): boolean {
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


type TransactionInfo = {hash: string; nonce: number;};

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
    from: {x: number, y: number};
    to: {x: number, y: number};
    distance: number;
    startTime: number; // this is the expected startTime, needed as sendTx could be pending
    duration: number; // could technically recompute it from spaceInfo // TODO ? if so move duration in RevealData type
};

type RevealSubmission = Reveal & {delegate?: string; signature: string; nonceMsTimestamp: number};

type AccountData = {
    nonceMsTimestamp: number;
    balance: string;
    delegate?: string; // TODO array or reverse lookup ?
} // TODO add balanceUsedUntilMined ?

// Data stored in the DO (Durable Object)
// sendConfirmed is a flag indicating whether the send transaction has been confirmed and startTime is now validated
type RevealData = RevealSubmission & {
    sendConfirmed: boolean;
    retries: number;
};

// Data stored when a transaction is broadcasted
type PendingTransactionData = RevealData & {tx: TransactionInfo};

// global index counter to ensure ordering of tx but also ensure their pendingID is unique
type TransactionsCounter = {
    nextIndex: number;
}

type RegistrationSubmission = {
    player: string;
    delegate: string;
    nonceMsTimestamp: number;
    signature: string;
}

// Data stored for fleetID to ensure only one fleetID is being queued across the queue.
// it also store the tx info
type ListData = {
    queueID?: string;
    pendingID?: string;
}

type SyncData = {
    blockHash: string;
    blockNumber: number;
}

const minimumBalance = parseEther('0.02'); // TODO ? // 100 gwei for 200,000 gas
const flatFee = minimumBalance;

const nonceAtStart = 0;

const RETRY_MAX_PERIOD =  1 * 60 * 60; // 1 hour?
function retryPeriod(duration: number): number {
    return Math.min(RETRY_MAX_PERIOD, duration);
}


function lexicographicNumber12(num: number): string {
    return num.toString().padStart(12, "0");
}
function lexicographicNumber8(num: number): string {
    return num.toString().padStart(8, "0");
}

function getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

function checkSubmission(data: RevealSubmission): {errorResponse?: Response, revealData?: RevealSubmission} {
    if (
        data.duration &&
        data.secret &&
        data.fleetID &&
        data.to && data.to.x !== undefined && data.to.y !== undefined &&
        data.startTime &&
        data.player &&
        data.distance &&
        data.from && data.from.x !== undefined && data.from.y !== undefined &&
        data.signature &&
        data.nonceMsTimestamp
        )
    {
        return {revealData: data};
    } else {
        return {errorResponse: TransactionInvalidMissingFields()};
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
            balance: "0",
            nonceMsTimestamp: 0
        }
    }
    if (registrationSubmission.nonceMsTimestamp <= account.nonceMsTimestamp || registrationSubmission.nonceMsTimestamp > timestampMs) {
        return InvalidNonce();
    }
    const authorized = isAuthorized(
        player,
        `conquest-agent-service: register ${registrationSubmission.delegate.toLowerCase()} as delegate for ${player} (nonce: ${registrationSubmission.nonceMsTimestamp})`,
        registrationSubmission.signature);
    // console.log({player, authorized, signature: registrationSubmission.signature});
    if (!authorized) {
        return NotAuthorized();
    }

    account.delegate = registrationSubmission.delegate.toLowerCase();
    account.nonceMsTimestamp = registrationSubmission.nonceMsTimestamp;
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
    const reveal = {...revealData, retries: 0, sendConfirmed: false};

    const timestampMs = Math.floor(Date.now());
    let lastSync = await this.state.storage.get<SyncData | undefined>('sync');
    if (!lastSync) {
        lastSync = {blockNumber: 0, blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000"};
    }
    let account = await this.state.storage.get<AccountData | undefined>(`account_${revealSubmission.player.toLowerCase()}`);
    if (!account) {
        account = {balance: "0", nonceMsTimestamp: 0};
    }

    if (revealSubmission.nonceMsTimestamp <= account.nonceMsTimestamp || revealSubmission.nonceMsTimestamp > timestampMs) {
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
    )
    console.log({queueMessageString, player, delegate: account.delegate, authorized, signature: revealSubmission.signature});
    if (!authorized) {
        return NotAuthorized();
    }

    let balance = BigNumber.from(account.balance);
    if (balance.lt(minimumBalance) ) { //|| !account.delegate) {

        // fetch latest events; (not finalized)
        const filter = this.paymentContract.filters.Payment(revealSubmission.player);
        const recentEvents = await this.paymentContract.queryFilter(filter, lastSync.blockNumber, "latest");
        for (const event of recentEvents) {
            if (event.args) {
                if (event.args.refund) {
                    balance = balance.sub(event.args.amount);
                } else {
                    // if (event.args.setDelegate.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
                    //     account.delegate = event.args.setDelegate.toLowerCase();
                    // }
                    balance = balance.add(event.args.amount);
                }
            }
        }
        if (balance.lt(minimumBalance)) {
            return NotEnoughBalance();
        }
    }



    const revealID = `l_${reveal.fleetID}`;
    const broadcastingTime = reveal.startTime + reveal.duration;
    const queueID = `q_${lexicographicNumber12(broadcastingTime)}_${reveal.fleetID}}`;

    const existing = await this.state.storage.get<ListData | undefined>(revealID);
    if (existing) {
        if(existing.pendingID) {
            // TODO what should we do here, for now reject
            // the transaction is already on its way and unless the initial data was wrong, the tx is going to go through and succeed (if sent/mined in time)
            // could add a FORCE option ?
            return AlreadyPending();
        } else if (!existing.queueID) {
            // impossible
        }else if (queueID != existing.queueID) {
            this.state.storage.delete(existing.queueID);
            // this.state.storage.delete(revealID); // no need as it will be overwritten below
        }
    }

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
        if (reveal.startTime + reveal.duration <= timestamp) {
          await this._executeReveal(queueID, reveal);
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

  async account(path: string[]): Promise<Response> {
    const accountID = `account_${path[0]?.toLowerCase()}`;
    const accountData = await this.state.storage.get<AccountData | undefined>(accountID);
    if (accountData) {
        return createResponse({account:accountData});
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

  async syncAccountBalances(path: string[]): Promise<Response> {
    const currentBlockNumber = await this.provider.getBlockNumber();
    const toBlockNumber = Math.max(0, currentBlockNumber - this.finality); // TODO configure finality
    const toBlockObject = await this.provider.getBlock(toBlockNumber);
    // const toBlock = toBlockObject.hash;

    let lastSync = await this.state.storage.get<SyncData | undefined>('sync');
    if (!lastSync) {
        lastSync = {blockNumber: 0, blockHash: ""};
    }

    // console.log({lastSync});

    // if there is no new block, no point processing, this will just handle reorg for no benefit
    if (toBlockNumber <= lastSync.blockNumber) {
        return  createResponse("no new block to fetch"); // TODO ?
    }
    const fromBlock = lastSync.blockNumber + 1;

    const accountsToUpdate: {[account: string]: {balanceUpdate: BigNumber}} = {};
    const events = await this.paymentContract.queryFilter(this.paymentContract.filters.Payment(), fromBlock, toBlockNumber);

    // console.log({events});
    for (const event of events) {
      if (event.removed) {
        continue; //ignore removed
      }
        if (event.args) {
          // console.log(event.args);
            const payer = event.args.payer.toLowerCase();
            const accountUpdate = accountsToUpdate[payer] = accountsToUpdate[payer] || {balanceUpdate: BigNumber.from(0)};
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
            currentAccountState = {balance: "0", nonceMsTimestamp: 0}
        }
        this.state.storage.put<AccountData>(
            `account_${accountAddress}`,
            {
                balance: accountUpdate.balanceUpdate.add(currentAccountState.balance).toString(),
                nonceMsTimestamp: currentAccountState.nonceMsTimestamp,
                delegate: currentAccountState.delegate
            }
        );
        console.log(`${accountAddress} updated...`)
    }
    lastSyncRefetched.blockHash = toBlockObject.hash;
    lastSyncRefetched.blockNumber = toBlockNumber;
    this.state.storage.put<SyncData>('sync', lastSyncRefetched);

    // console.log({lastSyncRefetched});
    return createResponse({success: true});
  }


  private async _executeReveal(queueID: string, reveal: RevealData) {
    const account = await this.state.storage.get<AccountData | undefined>(`account_${reveal.player}`);
    if (!account || BigNumber.from(account.balance).lt(minimumBalance)) {

        if(!account) {
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
    if (!reveal.sendConfirmed) { // TODO use reveal.sendTxHash will aloow to get confirmations, need to check if fleet exist
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
            reveal.retries ++;
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

            const {tx, error} = await this._submitTransaction(reveal, {expectedNonce: transactionsCounter.nextIndex}); // first save before broadcast ? // or catch "tx already submitted error"
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

            transactionsCounter.nextIndex ++;
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

  async _submitTransaction(reveal: RevealData, options: {expectedNonce? : number, forceNonce?: number}): Promise<{tx?: {hash: string; nonce: number;}; error?: {message: string, code: number}}> {
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
                return {error: {message: `nonce not matching, expected ${options.expectedNonce}, got ${nonce}`, code: 5501}}
            }
        }

        const tx = await this.outerspaceContract.resolveFleet(
            reveal.fleetID,
            xyToLocation(reveal.from.x, reveal.from.y),
            xyToLocation(reveal.to.x, reveal.to.y),
            reveal.distance,
            reveal.secret,
            {
                nonce
            }
        );
        return {tx: {hash:tx.hash, nonce: tx.nonce}};
      } catch(e) {
        const error = e as {message?: string}
        return {error: {message: error.message || "error caught: " + e, code: 5502}};
      }

  }

  async _checkPendingTransaction(pendingID: string, pendingReveal: PendingTransactionData): Promise<void> {
    const transaction = await this.provider.getTransactionReceipt(pendingReveal.tx.hash);
    if (!transaction) {
        console.log(`broadcast reveal tx for fleet: ${pendingReveal.fleetID} again...`);
        const {error, tx} = await this._submitTransaction(pendingReveal, {forceNonce: pendingReveal.tx.nonce});
        if (error) {
            // TODO
            return;
        } else if (!tx) {
            // impossible
            return;
        }
        pendingReveal.tx = tx;
        this.state.storage.put<PendingTransactionData>(pendingID, pendingReveal);
    } else if (transaction.confirmations >= 12) {
        this.state.storage.delete(pendingID);
        const revealID = `l_${pendingReveal.fleetID}`;
        this.state.storage.delete(revealID);
    } else {
        // TODO check timestamp
        // check expiry too
    }

  }

  async _fetchStartTime(reveal: RevealData): Promise<number | undefined> {
    // const tx = await this.provider.getTransactionReceipt(reveal.sendTxHash);
    // if (!tx) {
    //     const nonce = await this.provider.getTransactionCount(reveal.sendTxSender);
    // }
    const block = await this.provider.getBlock("latest");
    const lastestBlockFinalized = Math.max(0, block.number - 12);
    const fleet = await this.outerspaceContract.getFleet(reveal.fleetID, "0", {blockTag: lastestBlockFinalized});
    if (fleet.quantity > 0) {
        return fleet.launchTime;
    } else {
        return undefined;
    }
  }

}
