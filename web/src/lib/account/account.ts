import {SYNC_DB_NAME, SYNC_URI, setGetName} from '$lib/config';
import {bitMaskMatch} from '$lib/utils';
import type {SyncingState} from '$lib/utils/sync';
import {AccountDB} from '$lib/utils/sync';
import {xyToLocation} from 'conquest-eth-common';
import {writable} from 'svelte/store';
import type {Readable, Writable} from 'svelte/store';
import type {PrivateWalletState} from './privateWallet';
import {privateWallet} from './privateWallet';
import {keccak256} from '@ethersproject/solidity';
import type {MyEvent} from '$lib/space/myevents';
import {now, time} from '$lib/time';
import {BigNumber} from '@ethersproject/bignumber';
import {wallet} from '$lib/blockchain/wallet';

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
  external?: {status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT'; final?: number};
};

export type PendingSend = PendingActionBase & {
  type: 'SEND';
  fleetId: string;
  from: PlanetCoords;
  to: PlanetCoords;
  gift: boolean;
  specific: string;
  potentialAlliances?: string[];
  quantity: number;
  actualLaunchTime?: number;
  resolution?: string[];
  queueID?: string;
  fleetOwner: string;
  fleetSender?: string;
  operator?: string;
};

export type PendingResolution = PendingActionBase & {
  type: 'RESOLUTION';
  to: PlanetCoords;
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

export type Acknowledgement = {timestamp: number; stateHash: string};

export type Acknowledgements = {[id: string]: Acknowledgement};

export type AccountData = {
  pendingActions: PendingActions;
  welcomingStep: number;
  acknowledgements: Acknowledgements;
  agentServiceDefault?: {activated: boolean; timestamp: number};
};

function mergeStringArrays(
  localArray?: string[],
  remoteArray?: string[]
): {newOnLocal: boolean; newOnRemote: boolean; newArray?: string[]} {
  let newOnLocal = false;
  let newOnRemote = false;
  const hasLocalArray = typeof localArray !== 'undefined';
  const hasRemoteArray = typeof remoteArray !== 'undefined';
  if (!hasLocalArray && !hasRemoteArray) {
  } else if (hasLocalArray && !hasRemoteArray) {
    newOnLocal = true;
  } else if (!hasLocalArray && hasRemoteArray) {
    newOnRemote = true;
    localArray = remoteArray;
  } else {
    for (let i = 0; i < localArray.length; i++) {
      if (remoteArray.indexOf(localArray[i]) === -1) {
        newOnLocal = true;
      }
    }
    for (let i = 0; i < remoteArray.length; i++) {
      if (localArray.indexOf(remoteArray[i]) === -1) {
        newOnRemote = true;
        localArray.push(remoteArray[i]);
      }
    }
  }
  return {newOnLocal, newOnRemote, newArray: localArray};
}

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

  async recordWelcomingStep(bit: number): Promise<void> {
    this.check();
    if (bit > 32) {
      throw new Error('bit > 32');
    }
    this.state.data.welcomingStep = (this.state.data.welcomingStep || 0) | Math.pow(2, bit);
    await this.accountDB.save(this.state.data);
  }

  isWelcomingStepCompleted(bit: number): boolean {
    return bitMaskMatch(this.state.data?.welcomingStep, bit);
  }

  async recordAgentServiceDefault(activated: boolean): Promise<void> {
    this.check();
    this.state.data.agentServiceDefault = this.state.data.agentServiceDefault || {activated: false, timestamp: 0};
    this.state.data.agentServiceDefault.activated = activated;
    this.state.data.agentServiceDefault.timestamp = now();
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  isAgentServiceActivatedByDefault(): boolean {
    return this.state.data?.agentServiceDefault?.activated;
  }

  async recordCapture(planetCoords: PlanetCoords, txHash: string, timestamp: number, nonce: number): Promise<void> {
    this.check();
    this.state.data.pendingActions[txHash] = {
      type: 'CAPTURE',
      timestamp,
      nonce,
      planetCoords: {...planetCoords},
    };
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  async hashFleet(
    from: {x: number; y: number},
    to: {x: number; y: number},
    gift: boolean,
    specific: string,
    nonce: number,
    fleetOwner: string,
    fleetSender?: string,
    operator?: string
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
    const toHash = keccak256(['bytes32', 'uint256', 'bool', 'address'], [secretHash, toString, gift, specific]);
    const fleetId = keccak256(
      ['bytes32', 'uint256', 'address', 'address'],
      [toHash, fromString, fleetSender || fleetOwner, operator || fleetOwner]
    );
    return {toHash, fleetId, secretHash};
  }

  async recordFleet(
    fleet: {
      owner: string;
      id: string;
      from: PlanetCoords;
      to: PlanetCoords;
      gift: boolean;
      specific: string;
      potentialAlliances?: string[];
      fleetAmount: number;
      fleetSender?: string;
      operator?: string;
    },
    txHash: string,
    timestamp: number,
    nonce: number
  ): Promise<void> {
    this.check();
    this.state.data.pendingActions[txHash] = {
      fleetId: fleet.id,
      timestamp,
      nonce,
      type: 'SEND',
      from: {...fleet.from},
      to: {...fleet.to},
      gift: fleet.gift,
      specific: fleet.specific,
      potentialAlliances: fleet.potentialAlliances ? [...fleet.potentialAlliances] : undefined,
      quantity: fleet.fleetAmount,
      fleetSender: fleet.fleetSender,
      operator: fleet.operator,
      fleetOwner: fleet.owner,
    };
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  async recordFleetLaunchTime(txHash: string, launchTime: number): Promise<void> {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash] as PendingSend;
    if (pendingAction && typeof pendingAction !== 'number') {
      if (pendingAction.actualLaunchTime !== launchTime) {
        pendingAction.actualLaunchTime = launchTime;
        await this.accountDB.save(this.state.data);
        // this._notify();
      }
    }
  }

  async recordFleetResolvingTxhash(
    sendTxHash: string,
    txHash: string,
    to: {x: number; y: number},
    timestamp: number,
    nonce: number,
    agent: boolean
  ): Promise<void> {
    this.check();
    (this.state.data.pendingActions[sendTxHash] as PendingSend).resolution = [txHash]; // TODO multiple in array
    this.state.data.pendingActions[txHash] = {
      type: 'RESOLUTION',
      timestamp,
      nonce,
      to,
    };
    await this.accountDB.save(this.state.data);
    // TODO agent ?
    this._notify();
  }

  async recordExternalResolution(
    sendTxHash: string,
    to: {x: number; y: number},
    fleetId: string,
    final?: number
  ): Promise<void> {
    this.check();
    const sendAction = this.state.data.pendingActions[sendTxHash] as PendingSend | number;
    if (typeof sendAction === 'number') {
      return;
    }
    if (sendAction.resolution) {
      if (sendAction.resolution.indexOf(fleetId) !== -1) {
        return;
      }
      sendAction.resolution.push(fleetId);
    } else {
      sendAction.resolution = [fleetId];
    }
    if (!this.state.data.pendingActions[fleetId]) {
      const resolutionAction: PendingResolution = {
        type: 'RESOLUTION',
        external: {status: 'SUCCESS', final},
        timestamp: final,
        to,
        nonce: 0,
      };
      this.state.data.pendingActions[fleetId] = resolutionAction;
    }
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  async recordExit(
    planetCoords: {x: number; y: number},
    txHash: string,
    timestamp: number,
    nonce: number
  ): Promise<void> {
    this.check();
    this.state.data.pendingActions[txHash] = {
      type: 'EXIT',
      timestamp,
      nonce,
      planetCoords,
    };
    await this.accountDB.save(this.state.data);
    // TODO agent ?
    this._notify();
  }

  async deletePendingAction(txHash: string): Promise<void> {
    this.check();
    if (this.deletedPendingActions.indexOf(txHash) === -1) {
      this.deletedPendingActions.push(txHash);
    }
    delete this.state.data.pendingActions[txHash];
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  async cancelAcknowledgment(txHash: string): Promise<void> {
    this.check();
    const action = this.state.data.pendingActions[txHash];
    if (action && typeof action !== 'number') {
      action.acknowledged = undefined;
      await this.accountDB.save(this.state.data);
      this._notify();
    }
  }

  async acknowledgeEvent(event: MyEvent): Promise<void> {
    const fleetId = BigNumber.from(event.event.fleet.id).toHexString(); // TODO remove BigNumber conversion by makign fleetId bytes32 on OuterSPace.sol
    if (event.type === 'internal_fleet') {
      this.acknowledgeSuccess(event.event.transaction.id, fleetId);
      return;
    }
    this.check();
    const id = fleetId;
    const stateHash = event.event.planetLoss + ':' + event.event.fleetLoss + ':' + event.event.won; // TODO ensure we use same stateHash across code paths
    const acknowledgement = this.state.data?.acknowledgements[id];
    if (!acknowledgement) {
      this.state.data.acknowledgements[id] = {
        timestamp: now(),
        stateHash,
      };
      await this.accountDB.save(this.state.data);
      this._notify();
    } else if (acknowledgement.stateHash !== stateHash) {
      acknowledgement.timestamp = now();
      acknowledgement.stateHash = stateHash;
      await this.accountDB.save(this.state.data);
      this._notify();
    }
  }

  async acknowledgeSuccess(txHash: string, fleetId: string | null, final?: number): Promise<void> {
    return this.acknowledgeAction('SUCCESS', txHash, fleetId, final);
  }

  async acknowledgeError(txHash: string, fleetId: string | null, final?: number): Promise<void> {
    return this.acknowledgeAction('ERROR', txHash, fleetId, final);
  }

  async acknowledgeAction(
    statusType: 'SUCCESS' | 'ERROR',
    txHash: string,
    fleetId: string | null,
    final?: number
  ): Promise<void> {
    this.check();
    let idUsed = txHash;
    let pendingAction = this.state.data.pendingActions[txHash];
    if (!pendingAction) {
      pendingAction = this.state.data.pendingActions[fleetId];
      idUsed = fleetId;
    }
    if (pendingAction && typeof pendingAction !== 'number') {
      let sendAction: PendingSend;
      let sendActionTxHash: string;
      if (statusType === 'SUCCESS' && pendingAction.type === 'RESOLUTION') {
        for (const txHashToCheck of Object.keys(this.state.data.pendingActions)) {
          const p = this.state.data.pendingActions[txHashToCheck];
          if (typeof p !== 'number' && p.type === 'SEND') {
            if (p.resolution && p.resolution.indexOf(idUsed) !== -1) {
              sendAction = p;
              sendActionTxHash = txHashToCheck;
              break;
            }
          }
        }
      }
      // if (!sendAction || !sendActionTxHash) {
      //   console.error(`cannot find send action for resolution`);
      // }
      if (final) {
        this.state.data.pendingActions[idUsed] = final;
        if (sendAction) {
          this.state.data.pendingActions[sendActionTxHash] = final;
          if (sendAction.resolution) {
            for (const resolution of sendAction.resolution) {
              this.state.data.pendingActions[resolution] = final;
            }
          }
        }
      } else {
        pendingAction.acknowledged = statusType;
        if (sendAction) {
          sendAction.acknowledged = statusType;
          if (sendAction.resolution) {
            for (const resolutionId of sendAction.resolution) {
              const resolution = this.state.data.pendingActions[resolutionId];
              if (resolution && typeof resolution !== 'number') {
                resolution.acknowledged = statusType;
              }
            }
          }
        }
      }
    }
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  async markAsFullyAcknwledged(txHash: string, timestamp: number): Promise<void> {
    this.check();
    const action = this.state.data.pendingActions[txHash];
    if (action && typeof action !== 'number') {
      this.state.data.pendingActions[txHash] = timestamp;
      if (action.type === 'RESOLUTION') {
        for (const txHashToCheck of Object.keys(this.state.data.pendingActions)) {
          const p = this.state.data.pendingActions[txHashToCheck];
          if (typeof p !== 'number' && p.type === 'SEND') {
            if (p.resolution && p.resolution.indexOf(txHash) !== -1) {
              this.state.data.pendingActions[txHashToCheck] = timestamp;
              break;
            }
          }
        }
      }
      await this.accountDB.save(this.state.data);
      this._notify();
    }
  }

  async recordQueueID(txHash: string, queueID: string) {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash] as PendingSend;
    if (pendingAction && typeof pendingAction !== 'number') {
      if (pendingAction.queueID !== queueID) {
        pendingAction.queueID = queueID;
        await this.accountDB.save(this.state.data);
        this._notify();
      }
    }
  }

  async acknowledgeActionFailure(txHash: string, final?: number): Promise<void> {
    this.check();
    const pendingAction = this.state.data.pendingActions[txHash];
    if (pendingAction && typeof pendingAction !== 'number') {
      if (final) {
        this.state.data.pendingActions[txHash] = final;
      } else {
        pendingAction.acknowledged = 'ERROR';
      }
    }
    await this.accountDB.save(this.state.data);
    this._notify();
  }

  private check() {
    if (!this.state.data) {
      throw new Error(`Account not ready yet`);
    }
  }

  public isReady() {
    return !!this.state.data;
  }

  private _start(): () => void {
    this.stopPrivateWalletSubscription = privateWallet.subscribe(async ($privateWallet) => {
      await this._handlePrivateWalletChange($privateWallet);
    });
    return this._stop.bind(this);
  }

  private async _handlePrivateWalletChange($privateWallet: PrivateWalletState): Promise<void> {
    if ($privateWallet.step !== 'READY') {
      if (this.unsubscribeFromSync) {
        this.unsubscribeFromSync();
        this.unsubscribeFromSync = undefined;
      }
      this.state.step = 'IDLE';
      this.state.data = undefined;
      this.state.ownerAddress = $privateWallet.ownerAddress;
      this._notify();
      return;
    }
    if (
      !this.accountDB ||
      $privateWallet.ownerAddress !== this.accountDB.ownerAddress ||
      $privateWallet.chainId !== this.accountDB.chainId
    ) {
      if (this.unsubscribeFromSync) {
        this.unsubscribeFromSync();
        this.unsubscribeFromSync = undefined;
      }

      this.state.step = 'IDLE';
      this.state.data = undefined;
      // if (this.state.data) {this.state.data.pendingActions = {};}
      // if (this.state.data) {this.state.data.welcomingStep = undefined;}
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
        acknowledgements: {},
      };
    }

    if (!remoteData) {
      remoteData = {
        pendingActions: {},
        welcomingStep: 0,
        acknowledgements: {},
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

    if (remoteData.agentServiceDefault && !newData.agentServiceDefault) {
      newDataOnRemote = true;
      newData.agentServiceDefault = remoteData.agentServiceDefault;
    } else if (!remoteData.agentServiceDefault && newData.agentServiceDefault) {
      newDataOnLocal = true;
    } else if (remoteData.agentServiceDefault && newData.agentServiceDefault) {
      if (remoteData.agentServiceDefault.timestamp > newData.agentServiceDefault.timestamp) {
        newDataOnRemote = true;
        newData.agentServiceDefault = remoteData.agentServiceDefault;
      } else if (remoteData.agentServiceDefault.timestamp < newData.agentServiceDefault.timestamp) {
        newDataOnLocal = true;
      }
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
            if (pendingAction.type === 'SEND' && remotePendingAction.type === 'SEND') {
              const {newOnLocal, newOnRemote, newArray} = mergeStringArrays(
                pendingAction.resolution,
                remotePendingAction.resolution
              );
              if (newOnLocal) {
                newDataOnLocal = true;
              }
              if (newOnRemote) {
                pendingAction.resolution = newArray;
                newDataOnRemote = true;
              }

              if (pendingAction.actualLaunchTime && !remotePendingAction.actualLaunchTime) {
                newDataOnLocal = true;
              } else if (!pendingAction.actualLaunchTime && remotePendingAction.actualLaunchTime) {
                newDataOnRemote = true;
                pendingAction.actualLaunchTime = remotePendingAction.actualLaunchTime;
              }

              if (pendingAction.queueID && !remotePendingAction.queueID) {
                newDataOnLocal = true;
              } else if (!pendingAction.queueID && remotePendingAction.queueID) {
                newDataOnRemote = true;
                pendingAction.queueID = remotePendingAction.queueID;
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

    if (remoteData.acknowledgements) {
      for (const id of Object.keys(remoteData.acknowledgements)) {
        const remoteAcknowledgement = remoteData.acknowledgements[id];
        const acknowledgement = newData.acknowledgements[id];

        if (!acknowledgement) {
          newData.acknowledgements[id] = remoteAcknowledgement;
          newDataOnRemote = true;
        } else {
          if (typeof acknowledgement === 'number' && typeof remoteAcknowledgement !== 'number') {
            newDataOnLocal = true;
          } else if (typeof acknowledgement !== 'number' && typeof remoteAcknowledgement === 'number') {
            newDataOnRemote = true;
            newData.pendingActions[id] = remoteAcknowledgement;
          } else if (typeof acknowledgement !== 'number' && typeof remoteAcknowledgement !== 'number') {
            if (acknowledgement.timestamp !== remoteAcknowledgement.timestamp) {
              if (acknowledgement.timestamp > remoteAcknowledgement.timestamp) {
                newDataOnLocal = true;
              } else {
                newDataOnRemote = true;
                acknowledgement.timestamp = remoteAcknowledgement.timestamp;
                acknowledgement.stateHash = remoteAcknowledgement.stateHash;
              }
            }
          }
          // TODO more merge pendingAction
          // newDataOnLocal = true;
          // newDataOnRemote = true;
        }
      }
      for (const id of Object.keys(newData.acknowledgements)) {
        if (!remoteData.acknowledgements[id]) {
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

  generateError() {
    throw new Error(`error on version: ${__VERSION__}`);
  }
}

export const account = new Account();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).account = account;
}

setGetName(() => wallet.address || undefined);
