import {SYNC_DB_NAME, SYNC_URI} from '$lib/config';
import {bitMaskMatch} from '$lib/utils';
import type {SyncingState} from '$lib/utils/sync';
import {AccountDB} from '$lib/utils/sync';
import { xyToLocation } from 'conquest-eth-common';
import {writable} from 'svelte/store';
import type {Readable, Writable} from 'svelte/store';
import type {PrivateWalletState} from './privateWallet';
import {privateWallet} from './privateWallet';
import {keccak256} from '@ethersproject/solidity';

export type AccountState = {
  step: 'IDLE' | 'READY';
  data?: AccountData;
  syncing: boolean;
  remoteDisabledOrSynced: boolean;
  syncError?: unknown;
  ownerAddress?: string;
};

type PlanetCoords = {x: number; y: number};

type PendingActionBase = {
  txOrigin?: string; // used if the controller is not owner
  timestamp: number;
  nonce: number;
  acknowledged?: 'ERROR' | 'SUCCESS';
};


export type PendingSend = PendingActionBase & {
  type: 'SEND';
  from: PlanetCoords;
  to: PlanetCoords;
  quantity: number;
  actualLaunchTime?: number;
  resolution?: string[];
};

export type PendingResolution = PendingActionBase & {
  type: 'RESOLUTION';
};

export type PendingExit = PendingActionBase & {
  type: 'EXIT';
  planetCoords: PlanetCoords;
};

export type PendingWithdrawal = PendingActionBase & {
  type: 'WITHDRAWAL';
  planets: PlanetCoords[];
};

export type PendingCapture = PendingActionBase & {
  type: 'CAPTURE';
  planetCoords: PlanetCoords;
};

export type PendingAction = PendingSend | PendingExit | PendingCapture | PendingWithdrawal | PendingResolution;

export type PendingActions = {[txHash: string]: PendingAction | number};

export type AccountData = {
  pendingActions: PendingActions;
  welcomingStep: number;
};

class Account implements Readable<AccountState> {
  private state: AccountState;
  private store: Writable<AccountState>;

  private stopPrivateWalletSubscription: (() => void) | undefined = undefined;
  private accountDB: AccountDB<AccountData> | undefined;
  private unsubscribeFromSync: () => void;

  private deletedPendingActions: string[] = [];

  constructor() {
    this.state = {
      step: 'IDLE',
      data: undefined,
      syncing: false,
      remoteDisabledOrSynced: false,
    };
    this.store = writable(this.state, this._start.bind(this));
  }

  subscribe(run: (value: AccountState) => void, invalidate?: (value?: AccountState) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

  recordWelcomingStep(bit: number): void {
    this.check();
    if (bit > 32) {
      throw new Error('bit > 32');
    }
    this.state.data.welcomingStep = (this.state.data.welcomingStep || 0) | Math.pow(2, bit);
    this.accountDB.save(this.state.data);
  }

  isWelcomingStepCompleted(bit: number): boolean {
    return bitMaskMatch(this.state.data?.welcomingStep, bit);
  }

  recordCapture(planetCoords: PlanetCoords, txHash: string, timestamp: number, nonce: number): void {
    this.check();
    this.state.data.pendingActions[txHash] = {
      type: 'CAPTURE',
      timestamp,
      nonce,
      planetCoords: {...planetCoords},
    };
    this.accountDB.save(this.state.data);
    this._notify();
  }

  async hashFleet(
    from: {x: number; y: number},
    to: {x: number; y: number},
    nonce: number
  ): Promise<{toHash: string; fleetId: string; secretHash: string}> {
    // TODO use timestamp to allow user to retrieve a lost secret by knowing `to` and approximate time of launch
    // const randomNonce =
    //   '0x' +
    //   Array.from(crypto.getRandomValues(new Uint8Array(32)))
    //     .map((b) => b.toString(16).padStart(2, '0'))
    //     .join('');
    const toString = xyToLocation(to.x, to.y);
    const fromString = xyToLocation(from.x, from.y);
    // console.log({randomNonce, toString, fromString});
    const secretHash = keccak256(['bytes32', 'uint256', 'uint256'], [privateWallet.hashString(), fromString, nonce]);
    // console.log({secretHash});
    const toHash = keccak256(['bytes32', 'uint256'], [secretHash, toString]);
    const fleetId = keccak256(['bytes32', 'uint256'], [toHash, fromString]);
    return {toHash, fleetId, secretHash};
  }

  recordFleet(fleet: {from: PlanetCoords, to: PlanetCoords, fleetAmount: number}, txHash: string, timestamp: number, nonce: number): void {
    this.check();
    this.state.data.pendingActions[txHash] = {
      timestamp,
      nonce,
      type: 'SEND',
      from: {...fleet.from},
      to: {...fleet.to},
      quantity: fleet.fleetAmount
    };
    this.accountDB.save(this.state.data);
    this._notify();
  }

  recordFleetLaunchTime(txHash: string, launchTime: number): void {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash] as PendingSend;
    if (pendingAction && typeof pendingAction !== "number") {
      if (pendingAction.actualLaunchTime !== launchTime) {
        pendingAction.actualLaunchTime = launchTime;
        this.accountDB.save(this.state.data);
        // this._notify();
      }
    }
  }

  recordFleetResolvingTxhash(sendTxHash: string, txHash: string, timestamp: number, nonce: number, agent: boolean): void {
    this.check();
    (this.state.data.pendingActions[sendTxHash] as PendingSend).resolution = [txHash]; // TODO multiple in array
    this.state.data.pendingActions[txHash] = {
      type: 'RESOLUTION',
      timestamp,
      nonce
    };
    this.accountDB.save(this.state.data);
    // TODO agent ?
    this._notify();
  }

  recordExit(planetCoords: {x: number; y: number;}, txHash: string, timestamp: number, nonce: number): void {
    this.check();
    this.state.data.pendingActions[txHash] = {
      type: 'EXIT',
      timestamp,
      nonce,
      planetCoords
    };
    this.accountDB.save(this.state.data);
    // TODO agent ?
    this._notify();
  }

  deletePendingAction(txHash: string) {
    this.check();
    if (this.deletedPendingActions.indexOf(txHash) === -1) {
      this.deletedPendingActions.push(txHash);
    }
    delete this.state.data.pendingActions[txHash];
    this.accountDB.save(this.state.data);
    this._notify();
  }

  cancelAcknowledgment(txHash: string) {
    this.check();
    const action = this.state.data.pendingActions[txHash];
    if (action && typeof action !== 'number') {
      action.acknowledged = undefined;
      this.accountDB.save(this.state.data);
      this._notify();
    }
  }

  acknowledgeSuccess(txHash: string, final?: number) {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash];
    if (pendingAction && typeof pendingAction !== 'number') {
      if (final) {
        this.state.data.pendingActions[txHash] = final;
      } else {
        pendingAction.acknowledged = 'SUCCESS';
      }
    }
    this.accountDB.save(this.state.data);
    this._notify();
  }

  markAsFullyAcknwledged(txHash: string, timestamp: number) {
    this.check();
    const action = this.state.data.pendingActions[txHash];
    if (action && typeof action !== 'number') {
      this.state.data.pendingActions[txHash] = timestamp;
      this.accountDB.save(this.state.data);
      this._notify();
    }
  }

  acknowledgeActionFailure(txHash: string, final?: number) {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash];
    if (pendingAction && typeof pendingAction !== 'number') {
      if (final) {
        this.state.data.pendingActions[txHash] = final;
      } else {
        pendingAction.acknowledged = 'ERROR';
      }
    }
    this.accountDB.save(this.state.data);
    this._notify();
  }

  private check() {
    if (!this.state.data) {
      throw new Error(`Account not ready yet`);
    }
  }

  private _start(): () => void {
    this.stopPrivateWalletSubscription = privateWallet.subscribe(async ($privateWallet) => {
      await this._handlePrivateWalletChange($privateWallet);
    });
    return this._stop.bind(this);
  }

  private async _handlePrivateWalletChange($privateWallet: PrivateWalletState): Promise<void> {
    if (
      !this.accountDB ||
      $privateWallet.ownerAddress !== this.accountDB.ownerAddress ||
      $privateWallet.chainId !== this.accountDB.chainId
    ) {
      if (this.unsubscribeFromSync) {
        this.unsubscribeFromSync();
        this.unsubscribeFromSync = undefined;
      }

      this.state.ownerAddress = $privateWallet.ownerAddress;
      this._notify();

      if ($privateWallet.ownerAddress) {
        this.accountDB = new AccountDB(
          $privateWallet.ownerAddress,
          $privateWallet.chainId,
          SYNC_URI,
          SYNC_DB_NAME,
          $privateWallet.signer,
          $privateWallet.aesKey,
          this._merge.bind(this),
          $privateWallet.syncEnabled
        );
        this.unsubscribeFromSync = this.accountDB.subscribe(this.onSync.bind(this));
        this.accountDB.requestSync();
      }
    }
  }

  private onSync(syncingState: SyncingState<AccountData>): void {
    this.state.syncError = syncingState.error;
    this.state.data = syncingState.data;
    this.state.syncing = syncingState.syncing;
    this.state.remoteDisabledOrSynced = syncingState.remoteFetchedAtLeastOnce || !syncingState.remoteSyncEnabled;
    if (this.state.data) {
      this.state.step = 'READY';
    } else {
      this.state.step = 'IDLE';
    }
    this._notify();
  }

  private _merge(
    localData?: AccountData,
    remoteData?: AccountData
  ): {newData: AccountData; newDataOnLocal: boolean; newDataOnRemote: boolean} {
    let newDataOnLocal = false;
    let newDataOnRemote = false;
    let newData = localData;
    if (!newData) {
      newData = {
        pendingActions: {},
        welcomingStep: 0,
      };
    }

    if (!remoteData) {
      remoteData = {
        pendingActions: {},
        welcomingStep: 0,
      };
    }

    for (const txHash of this.deletedPendingActions) {
      if (remoteData.pendingActions[txHash]) {
        delete remoteData.pendingActions[txHash];
        newDataOnLocal = true;
      }
      if (newData.pendingActions[txHash]) {
        delete newData.pendingActions[txHash];
        newDataOnLocal = true;
      }
    }

    if (remoteData.welcomingStep > newData.welcomingStep) {
      newDataOnRemote = true;
      newData.welcomingStep = newData.welcomingStep | remoteData.welcomingStep;
    } else if (!remoteData.welcomingStep || newData.welcomingStep > remoteData.welcomingStep) {
      newDataOnLocal = true;
    }
    if (remoteData.pendingActions) {
      for (const txHash of Object.keys(remoteData.pendingActions)) {
        const remotePendingAction = remoteData.pendingActions[txHash];
        const pendingAction = newData.pendingActions[txHash];

        if (!pendingAction) {
          newData.pendingActions[txHash] = remotePendingAction;
          newDataOnRemote = true;
        } else {
          if (typeof pendingAction === 'number' && typeof remotePendingAction !== 'number') {
            newDataOnLocal = true;
          } else if (typeof pendingAction !== 'number' && typeof remotePendingAction === 'number') {
            newDataOnRemote = true;
            newData.pendingActions[txHash] = remotePendingAction;
          } else if (typeof pendingAction !== 'number' && typeof remotePendingAction !== 'number') {
            if (pendingAction.acknowledged !== remotePendingAction.acknowledged) {
              if (pendingAction.acknowledged) {
                newDataOnLocal = true;
              } else {
                newDataOnRemote = true;
                pendingAction.acknowledged = remotePendingAction.acknowledged;
              }
            }
          }
          // TODO more merge pendingAction
          // newDataOnLocal = true;
          // newDataOnRemote = true;
        }
      }
      for (const txHash of Object.keys(newData.pendingActions)) {
        if (!remoteData.pendingActions[txHash]) {
          newDataOnLocal = true;
        }
      }
    } else {
      newDataOnLocal = true;
    }

    return {
      newData,
      newDataOnLocal,
      newDataOnRemote,
    };
  }

  private _stop(): void {
    if (this.stopPrivateWalletSubscription) {
      this.stopPrivateWalletSubscription();
      this.stopPrivateWalletSubscription = undefined;
    }
  }

  private _notify(): void {
    this.store.set(this.state);
  }
}

export const account = new Account();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).account = account;
}
