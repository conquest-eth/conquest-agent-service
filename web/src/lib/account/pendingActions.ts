import {writable} from 'svelte/store';
import type {Readable, Writable} from 'svelte/store';
import type {AccountState, PendingAction, PendingSend} from './account';
import {account} from './account';
import type {ChainTempoInfo} from '$lib/blockchain/chainTempo';
import {chainTempo} from '$lib/blockchain/chainTempo';
import {wallet} from '$lib/blockchain/wallet';
import {now} from '$lib/time';
import {deletionDelay, finality} from '$lib/config';

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

export type CheckedPendingAction<T extends PendingAction = PendingAction> = {
  id: string;
  final?: number;
  txTimestamp?: number;
  status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
  action: T;
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
        if (typeof action === 'number') {
          continue;
        }
        // if (action.acknowledged) {
        //   continue;
        // }
        const found = this.state.find((v) => v.id === txHash);
        if (!found) {
          this.state.push({
            id: txHash,
            status: action.external ? action.external.status : 'LOADING',
            final: action.external ? action.external.final : undefined,
            action,
          });
        }
      }
      for (let i = this.state.length - 1; i >= 0; i--) {
        if (
          !$account.data.pendingActions[this.state[i].id] ||
          typeof $account.data.pendingActions[this.state[i].id] === 'number'
        ) {
          this.state.splice(i, 1);
        }
      }
    } else {
      this.state.length = 0;
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
      if (item.action.external) {
        item.final = item.action.external.final;
        item.status = item.action.external.status;
        if (item.final) {
          this._handleFinalAcknowledgement(item, item.final, 'SUCCESS');
        }
        continue;
      }
      try {
        await this._checkAction(ownerAddress, item, $chainTempoInfo.lastBlockNumber);

        if (this.ownerAddress !== ownerAddress) {
          this.checkingInProgress = false;
          return;
        }
        if (item.action.type === 'SEND') {
          await this._checkResolutionViaSend(
            ownerAddress,
            item as CheckedPendingAction<PendingSend>,
            $chainTempoInfo.lastBlockNumber
          );
        }
      } catch (e) {
        console.error(e);
      }
      if (this.ownerAddress !== ownerAddress) {
        this.checkingInProgress = false;
        return;
      }
    }
    this.checkingInProgress = false;
  }

  private _handleFinalAcknowledgement(
    checkedAction: CheckedPendingAction,
    timestamp: number,
    finalStatus: 'SUCCESS' | 'ERROR'
  ) {
    if (now() - timestamp > deletionDelay) {
      console.log(`delay over, deleting ${checkedAction.id}`);
      account.deletePendingAction(checkedAction.id);
    } else {
      if (checkedAction.action.acknowledged) {
        if (checkedAction.action.acknowledged !== finalStatus) {
          console.log(`cancel acknowledgement as not matching new status ${checkedAction.id}`);
          account.cancelAcknowledgment(checkedAction.id);
        } else if (typeof checkedAction.action !== 'number') {
          console.log(`acknowledgedment final for ${checkedAction.id}`);
          account.markAsFullyAcknwledged(checkedAction.id, timestamp);
        }
      } else {
        console.log(`not acknowledged yet`);
      }
    }
  }

  private async _checkResolutionViaSend(
    ownerAddress: string,
    checkedAction: CheckedPendingAction<PendingSend>,
    blockNumber: number
  ): Promise<void> {
    if (!wallet.provider) {
      return;
    }

    if (typeof checkedAction.action === 'number') {
      return;
    }

    if (checkedAction.status === 'SUCCESS' && checkedAction.final) {
      const fleet = await wallet.contracts.OuterSpace.getFleet(checkedAction.action.fleetId, '0');
      if (fleet.owner != '0x0000000000000000000000000000000000000000' && fleet.quantity == 0) {
        let final = false;
        const finalisedBlockNumber = Math.max(0, blockNumber - finality);
        const finalisedBlock = await wallet.provider.getBlock(finalisedBlockNumber);
        const finalizedFleet = await wallet.contracts.OuterSpace.getFleet(checkedAction.action.fleetId, '0', {
          blockTag: finalisedBlockNumber,
        });
        if (finalizedFleet.owner != '0x0000000000000000000000000000000000000000' && finalizedFleet.quantity == 0) {
          final = true;
        }
        if (this.ownerAddress !== ownerAddress) {
          return;
        }
        await account.recordExternalResolution(
          checkedAction.id,
          checkedAction.action.fleetId,
          final ? finalisedBlock.timestamp : undefined
        );
      }
    }
  }

  private async _checkAction(ownerAddress: string, checkedAction: CheckedPendingAction, blockNumber: number) {
    if (!wallet.provider) {
      return;
    }

    if (typeof checkedAction.action === 'number') {
      if (now() - checkedAction.action > deletionDelay) {
        account.deletePendingAction(checkedAction.id);
      }
      return;
    }

    if (
      checkedAction.final &&
      (checkedAction.action.external || (checkedAction.status !== 'PENDING' && checkedAction.status !== 'LOADING'))
    ) {
      const status = checkedAction.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR';
      this._handleFinalAcknowledgement(checkedAction, checkedAction.final, status);
      return;
    }

    let changes = false;

    const txFromPeers = await wallet.provider.getTransaction(checkedAction.id);
    let pending = true;
    if (txFromPeers) {
      if (txFromPeers.blockNumber) {
        pending = false;
        const receipt = await wallet.provider.getTransactionReceipt(checkedAction.id);
        const block = await wallet.provider.getBlock(txFromPeers.blockHash);
        const final = receipt.confirmations >= finality;
        if (receipt.status === 0) {
          if (checkedAction.status !== 'FAILURE' || checkedAction.final !== block.timestamp) {
            checkedAction.status = 'FAILURE';
            checkedAction.txTimestamp = block.timestamp;
            changes = true;
            checkedAction.final = final ? block.timestamp : undefined;
            if (final) {
              this._handleFinalAcknowledgement(checkedAction, block.timestamp, 'ERROR');
            }
          }
        } else {
          if (checkedAction.status !== 'SUCCESS' || checkedAction.final !== block.timestamp) {
            checkedAction.status = 'SUCCESS';
            checkedAction.txTimestamp = block.timestamp;
            changes = true;
            checkedAction.final = final ? block.timestamp : undefined;
            if (final) {
              this._handleFinalAcknowledgement(checkedAction, txFromPeers.timestamp, 'ERROR');
            }
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
        if (checkedAction.status !== 'CANCELED' || checkedAction.final !== checkedAction.action.timestamp) {
          checkedAction.status = 'CANCELED';
          checkedAction.final = checkedAction.action.timestamp;
          this._handleFinalAcknowledgement(checkedAction, checkedAction.action.timestamp, 'ERROR');
          changes = true;
        }
      }
    }

    if (pending) {
      if (now() - checkedAction.action.timestamp > 3600) {
        // 1 hour to TODO config
        if (checkedAction.status !== 'TIMEOUT' || checkedAction.final !== checkedAction.action.timestamp) {
          checkedAction.status = 'TIMEOUT';
          checkedAction.final = checkedAction.action.timestamp;
          this._handleFinalAcknowledgement(checkedAction, checkedAction.action.timestamp, 'ERROR');
          changes = true;
        }
      } else {
        if (checkedAction.status !== 'PENDING') {
          checkedAction.status = 'PENDING';
          changes = true;
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
