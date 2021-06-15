import {SYNC_DB_NAME, SYNC_URI} from '$lib/config';
import {bitMaskMatch} from '$lib/utils';
import {AccountDB, SyncingState} from '$lib/utils/sync';
import {Readable, Writable, writable} from 'svelte/store';
import {privateWallet, PrivateWalletState} from './privateWallet';

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
  acknowledged?: {
    final: boolean;
    type: 'ERROR' | 'SUCCESS';
  };
};

type PendingResolution = {
  txOrigin?: string; // used if the resolver is not owner (agent)
  timestamp: number;
  nonce: number;
  txHash: string;
};

export type PendingSend = PendingActionBase & {
  type: 'SEND';
  from: PlanetCoords;
  to: PlanetCoords;
  quantity: number;
  resolution?: PendingResolution;
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

export type PendingAction = PendingSend | PendingExit | PendingCapture | PendingWithdrawal;

export type PendingActions = {[txHash: string]: PendingAction};

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
  }

  acknowledgeActionFailure(txHash: string, final: boolean) {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash];
    if (pendingAction) {
      pendingAction.acknowledged = {
        final,
        type: 'ERROR',
      };
    }
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

    if (remoteData.welcomingStep > newData.welcomingStep) {
      newDataOnRemote = true;
      newData.welcomingStep = newData.welcomingStep | remoteData.welcomingStep;
    } else if (!remoteData.welcomingStep || newData.welcomingStep > remoteData.welcomingStep) {
      newDataOnLocal = true;
    }
    if (remoteData.pendingActions) {
      for (const txHash of Object.keys(remoteData.pendingActions)) {
        const pendingAction = newData.pendingActions[txHash];
        if (!pendingAction) {
          newData.pendingActions[txHash] = remoteData.pendingActions[txHash];
          newDataOnRemote = true;
        } else {
          // TODO merge pendingAction
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
