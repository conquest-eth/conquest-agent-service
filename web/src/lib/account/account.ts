import {SYNC_DB_NAME, SYNC_URI} from '$lib/config';
import {AccountDB, SyncingState} from '$lib/utils/sync';
import {Readable, Writable, writable} from 'svelte/store';
import {privateWallet, PrivateWalletState} from './privateWallet';

export type AccountState = {
  step: 'IDLE' | 'READY';
  data?: AccountData;
  syncing: boolean;
  remoteDisabledOrSynced: boolean;
  syncError?: unknown;
};

export type AccountData = {
  pendingActions: {[id: string]: {timestamp: number}};
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
    if (bit > 32) {
      throw new Error('bit > 32');
    }
    if (!this.state.data) {
      throw new Error(`Account not ready yet`);
    }
    this.state.data.welcomingStep = Math.pow(2, bit);
    this.accountDB.save(this.state.data);
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
    if (remoteData) {
      if (remoteData.welcomingStep > newData.welcomingStep) {
        newDataOnRemote = true;
        newData.welcomingStep = newData.welcomingStep | remoteData.welcomingStep;
      } else if (newData.welcomingStep > remoteData.welcomingStep) {
        newDataOnLocal = true;
      }
    } else {
      newDataOnLocal = true;
    }

    // TODO pendingActions

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
