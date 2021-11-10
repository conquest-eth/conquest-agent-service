import {account} from '$lib/account/account';
import type {SpaceQueryWithPendingState, SyncedPendingAction} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {now, time} from '$lib/time';
import type {SpaceInfo, PlanetInfo} from 'conquest-eth-common';
import type {Readable, Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';

export type FleetState =
  | 'LOADING'
  | 'SEND_BROADCASTED'
  | 'TRAVELING'
  | 'READY_TO_RESOLVE'
  | 'TOO_LATE_TO_RESOLVE'
  | 'RESOLVE_BROADCASTED'
  | 'WAITING_ACKNOWLEDGMENT';

// object representing a fleet (publicly)
export type Fleet = {
  txHash: string; // TODO better id
  from: PlanetInfo;
  to: PlanetInfo;
  quantity: number; // not needed to store, except to not require contract fetch
  duration: number;
  launchTime: number;
  amountDestroyed: number;
  timeLeft: number; // not needed to store, except to not require computing stats from from planet
  timeToResolve: number;
  gift: boolean;
  potentialAlliances?: string[];
  owner: string;
  fleetSender?: string;
  operator?: string;
  sending: {
    id: string;
    status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
    action: {nonce: number; timestamp: number; queueID?: string};
  }; // TODO use pendingaction type
  resolution?: {
    id: string;
    status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
    action: {nonce: number; timestamp: number};
  }; // TODO use pendingaction type
  state: FleetState;
};

export type FleetListState = {fleets: Fleet[]; step: 'LOADING' | 'IDLE' | 'LOADED'};

export class FleetsStore implements Readable<FleetListState> {
  private readonly spaceInfo: SpaceInfo;
  private store: Writable<FleetListState>;
  public state: FleetListState = {
    fleets: [],
    step: 'IDLE',
  };

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable(this.state, this._start.bind(this));
  }

  _start(): void {
    time.subscribe(this.onTime.bind(this));
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private onTime() {
    for (const fleet of this.state.fleets) {
      fleet.timeLeft = Math.max(fleet.duration - (now() - fleet.launchTime), 0);
      if (fleet.timeLeft <= 0) {
        fleet.timeToResolve = Math.max(fleet.launchTime + fleet.duration + spaceInfo.resolveWindow - now(), 0);
      }
    }
    this.store.set(this.state);
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    this.state.fleets.length = 0;
    let loading = false;

    const pendingActions = update.queryState.data ? update.pendingActions : update.rawPendingActions;

    for (const pendingAction of pendingActions) {
      if (pendingAction.action.type === 'SEND') {
        const sendAction = pendingAction.action;
        // TODO
        if (pendingAction.status === 'FAILURE') {
        } else if (pendingAction.status === 'CANCELED') {
        } else if (pendingAction.status === 'TIMEOUT') {
        } else {
          const from = spaceInfo.getPlanetInfo(sendAction.from.x, sendAction.from.y);
          const to = spaceInfo.getPlanetInfo(sendAction.to.x, sendAction.to.y);
          const duration = spaceInfo.timeToArrive(from, to);
          let launchTime = now(); // TODO  update.queryState.data?.chain.timestamp ?
          if (sendAction.actualLaunchTime) {
            launchTime = sendAction.actualLaunchTime;
          } else if (pendingAction.txTimestamp) {
            launchTime = pendingAction.txTimestamp;
            account.recordFleetLaunchTime(pendingAction.id, launchTime);
          }

          const timeLeft = Math.max(duration - (now() - launchTime), 0);
          let timeToResolve = 0;

          let state: FleetState = 'SEND_BROADCASTED';
          if (pendingAction.status === 'SUCCESS') {
            state = 'TRAVELING';
            if (timeLeft <= 0) {
              state = 'READY_TO_RESOLVE';
              timeToResolve = Math.max(launchTime + duration + spaceInfo.resolveWindow - now(), 0);
              if (timeToResolve <= 0) {
                state = 'TOO_LATE_TO_RESOLVE';
              }
            }
          } else if (pendingAction.status === 'LOADING') {
            state = 'LOADING';
            loading = true;
          }

          let resolution: SyncedPendingAction | undefined;
          if (sendAction.resolution) {
            // console.log('RESOLUTION', sendAction.resolution);
            // TODO handle multiple resolution
            const pendingResolution = update.pendingActions.find((v) => v.id === sendAction.resolution[0]);
            if (pendingResolution) {
              resolution = pendingResolution;
              state = 'RESOLVE_BROADCASTED';

              if (pendingResolution.action.acknowledged) {
                continue; // alterady acknowledged
              }

              if (resolution.status === 'SUCCESS' || resolution.counted) {
                // TODO error
                state = 'WAITING_ACKNOWLEDGMENT';
                // continue; // acknowledgement go through events // TODO enable even though but should be required
              }
            } else {
              // TODO error ?
            }
          } else if (
            state === 'READY_TO_RESOLVE' &&
            sendAction.queueID &&
            spaceInfo.resolveWindow - timeToResolve < 10 * 60
          ) {
            // TODO config : 10 * 60 = 10 min late before showing the button to resolve manually
            state = 'RESOLVE_BROADCASTED'; //TODO add another state for agent-service handling
          }
          // console.log({state})
          if (!(resolution && resolution.action.acknowledged)) {
            this.state.fleets.push({
              txHash: pendingAction.id, // TODO better id
              from,
              to,
              duration,
              quantity: sendAction.quantity,
              launchTime,
              amountDestroyed: 0, // TODO
              timeLeft,
              timeToResolve,
              sending: pendingAction,
              resolution,
              state,
              gift: sendAction.gift,
              potentialAlliances: sendAction.potentialAlliances,
              owner: sendAction.fleetOwner,
              fleetSender: sendAction.fleetSender,
              operator: sendAction.operator,
            });
          }
        }
      }
    }

    if (loading) {
      this.state.step = 'LOADING';
    } else {
      this.state.step = 'LOADED';
    }

    this.store.set(this.state);
  }

  subscribe(run: (value: FleetListState) => void, invalidate?: (value?: FleetListState) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }
}

export const fleetList = new FleetsStore(spaceInfo);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fleetList = fleetList;
}
