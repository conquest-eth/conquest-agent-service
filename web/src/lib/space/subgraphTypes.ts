export type OwnerEvent = {
  transaction: {id: string};
  owner: {id: string};
  timestamp: string;
  blockNumber: number;
};

export type GenericEvent =
  | PlanetStakeEvent
  | PlanetExitEvent
  | FleetArrivedEvent
  | FleetSentEvent
  | TravelingUpkeepReductionFromDestructionEvent
  | StakeToWithdrawEvent
  | ExitCompleteEvent;

export type PlanetEvent = OwnerEvent & {
  __typename:
    | 'PlanetStakeEvent'
    | 'PlanetExitEvent'
    | 'FleetSentEvent'
    | 'FleetArrivedEvent'
    | 'TravelingUpkeepReductionFromDestructionEvent'
    | 'StakeToWithdrawEvent'
    | 'ExitCompleteEvent';
  planet: {id: string};
};

export type PlanetStakeEvent = PlanetEvent & {
  __typename: 'PlanetStakeEvent';
  numSpaceships: string;
  stake: string;
};

export type ExitCompleteEvent = PlanetEvent & {
  __typename: 'ExitCompleteEvent';
  stake: string;
};

export type StakeToWithdrawEvent = OwnerEvent & {
  __typename: 'StakeToWithdrawEvent';
  newStake: string;
};

export type TravelingUpkeepReductionFromDestructionEvent = PlanetEvent & {
  __typename: 'TravelingUpkeepReductionFromDestructionEvent';
  fleet: {id: string};
  newNumspaceships: string;
  newTravelingUpkeep: string;
  newOverflow: string;
};

export type PlanetExitEvent = PlanetEvent & {
  __typename: 'PlanetExitEvent';
  exitTime: string;
  stake: string;
  interupted: boolean;
  complete: boolean;
  success: boolean;
};

export type PlanetInteruptedExitEvent = PlanetExitEvent & {
  interupted: true;
};
export type planetTimePassedExitEvent = PlanetExitEvent & {
  interupted: false;
};

export type FleetArrivedEvent = PlanetEvent & {
  __typename: 'FleetArrivedEvent';
  fleetLoss: string;
  planetLoss: string;
  inFlightFleetLoss: string;
  inFlightPlanetLoss: string;
  destinationOwner: {id: string};
  gift: boolean;
  fleet: {id: string};
  from: {id: string};
  won: boolean;
  quantity: string;
  planet: {id: string};
  newNumspaceships: string;
  newTravelingUpkeep: string;
  newOverflow: string;
  accumulatedDefenseAdded: string;
  accumulatedAttackAdded: string;
};

export type FleetSentEvent = PlanetEvent & {
  __typename: 'FleetSentEvent';
  fleet: {id: string};
  quantity: string;
};
