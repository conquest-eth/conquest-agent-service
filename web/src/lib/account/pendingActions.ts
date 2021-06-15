import {Readable, Writable, writable} from 'svelte/store';
import {account, AccountState, PendingCapture, PendingExit, PendingSend, PendingWithdrawal} from './account';
import {chainTempo, ChainTempoInfo} from '$lib/blockchain/chainTempo';
import {wallet} from '$lib/blockchain/wallet';
import {now} from '$lib/time';
import {finality} from '$lib/config';

// type CheckedStatus = {
//   failedAtBlock?: number;
// };

// export type CheckedPendingSend = PendingSend & CheckedStatus;
// export type CheckedPendingExit = PendingExit & CheckedStatus;
// export type CheckedPendingCapture = PendingCapture & CheckedStatus;
// export type CheckedPendingWithdrawal = PendingWithdrawal & CheckedStatus;

// type CheckedAction<T> = {
//   failedAtBlock?: number;
//   action: T;
// };

// export type CheckedPendingSend = CheckedAction<PendingSend>;
// export type CheckedPendingExit = CheckedAction<PendingExit>;
// export type CheckedPendingCapture = CheckedAction<PendingCapture>;
// export type CheckedPendingWithdrawal = CheckedAction<PendingWithdrawal>;

// export type CheckedPendingAction =
//   | CheckedPendingSend
//   | CheckedPendingExit
//   | CheckedPendingCapture
//   | CheckedPendingWithdrawal

export type CheckedPendingAction = {
  id: string;
  final?: boolean;
  status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
  action: PendingSend | PendingExit | PendingCapture | PendingWithdrawal;
};

export type CheckedPendingActions = CheckedPendingAction[];

class PendingActionsStore implements Readable<CheckedPendingActions> {
  private state: CheckedPendingActions;
  private store: Writable<CheckedPendingActions>;
  private checkingInProgress = false;
  private ownerAddress: string | undefined;

  private stopAccountSubscription: (() => void) | undefined = undefined;
  private stopChainTempoSubscription: (() => void) | undefined = undefined;

  constructor() {
    this.state = [];
    this.store = writable(this.state, this._start.bind(this));
  }

  subscribe(
    run: (value: CheckedPendingActions) => void,
    invalidate?: (value?: CheckedPendingActions) => void
  ): () => void {
    return this.store.subscribe(run, invalidate);
  }

  private _start(): () => void {
    this.stopAccountSubscription = account.subscribe(async ($account) => {
      await this._handleAccountChange($account);
    });
    this.stopChainTempoSubscription = chainTempo.subscribe(async ($chainTempoInfo) => {
      await this._handleChainTempo($chainTempoInfo);
    });
    return this._stop.bind(this);
  }

  private async _handleAccountChange($account: AccountState): Promise<void> {
    if ($account.data) {
      const txHashes = Object.keys($account.data.pendingActions);
      for (const txHash of txHashes) {
        const action = $account.data.pendingActions[txHash];
        if (action.acknowledged && action.acknowledged.final) {
          continue;
        }
        const found = this.state.find((v) => v.id === txHash);
        if (!found) {
          this.state.push({
            id: txHash,
            status: 'LOADING',
            action,
          });
        }
      }
      for (let i = this.state.length - 1; i >= 0; i--) {
        if (!$account.data.pendingActions[this.state[i].id]) {
          this.state.splice(i, 1);
        }
      }
    }

    this.ownerAddress = $account.ownerAddress;

    this._notify();
  }

  private async _handleChainTempo($chainTempoInfo: ChainTempoInfo): Promise<void> {
    if (!$chainTempoInfo.lastBlockNumber) {
      return; // TODO ?
    }
    if (this.checkingInProgress) {
      return;
    }
    const ownerAddress = this.ownerAddress;
    this.checkingInProgress = true;
    for (const item of this.state) {
      await this._checkAction(ownerAddress, item, $chainTempoInfo.lastBlockNumber);
      if (this.ownerAddress !== ownerAddress) {
        this.checkingInProgress = false;
        return;
      }
    }
    this.checkingInProgress = false;
  }

  private async _checkAction(ownerAddress: string, checkedAction: CheckedPendingAction, blockNumber: number) {
    if (!wallet.provider) {
      return;
    }
    if (checkedAction.final) {
      return;
    }
    let changes = false;
    if (checkedAction.action.type === 'SEND') {
      // TODO
    } else {
      const txFromPeers = await wallet.provider.getTransaction(checkedAction.id);
      let pending = true;
      if (txFromPeers) {
        if (txFromPeers.blockNumber) {
          pending = false;
          const receipt = await wallet.provider.getTransactionReceipt(checkedAction.id);
          const final = receipt.confirmations >= finality;
          if (receipt.status === 0) {
            if (checkedAction.status !== 'FAILURE') {
              checkedAction.status = 'FAILURE';
              changes = true;
              checkedAction.final = final;
            }
          } else {
            if (checkedAction.status !== 'SUCCESS') {
              checkedAction.status = 'SUCCESS';
              changes = true;
              checkedAction.final = final;
            }
          }
        }
      } else {
        const finalityNonce = await wallet.provider.getTransactionCount(
          checkedAction.action.txOrigin || ownerAddress,
          blockNumber - finality
        );
        if (finalityNonce > checkedAction.action.nonce) {
          pending = false;
          // replaced
          if (checkedAction.status !== 'CANCELED') {
            checkedAction.status = 'CANCELED';
            checkedAction.final = true;
            changes = true;
          }
        }
      }

      if (pending) {
        if (now() - checkedAction.action.timestamp > 3600) {
          // 1 hour to TODO config
          if (checkedAction.status !== 'TIMEOUT') {
            checkedAction.status = 'TIMEOUT';
            checkedAction.final = true;
            changes = true;
          }
        } else {
          if (checkedAction.status !== 'PENDING') {
            checkedAction.status = 'PENDING';
            changes = true;
          }
        }
      }
    }

    if (this.ownerAddress !== ownerAddress) {
      return;
    }

    if (changes) {
      this._notify();
    }
  }

  private _stop(): void {
    if (this.stopAccountSubscription) {
      this.stopAccountSubscription();
      this.stopAccountSubscription = undefined;
    }
    if (this.stopChainTempoSubscription) {
      this.stopChainTempoSubscription();
      this.stopChainTempoSubscription = undefined;
    }
  }

  private _notify(): void {
    this.store.set(this.state);
  }
}

export const pendingActions = new PendingActionsStore();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).pendingActions = pendingActions;
}
