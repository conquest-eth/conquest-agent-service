export type OwnerEvent = {
  transaction: {id: string};
  owner: {id: string};
  timestamp: string;
  blockNumber: number;
};

export type GenericEvent = PlanetStakeEvent | PlanetExitEvent | FleetArrivedEvent | FleetSentEvent; // | ExitCompleteEvent ?

export type PlanetEvent = OwnerEvent & {
  __typename: 'PlanetStakeEvent' | 'PlanetExitEvent' | 'FleetSentEvent' | 'FleetArrivedEvent';
  planet: {id: string};
};

export type PlanetStakeEvent = PlanetEvent & {
  __typename: 'PlanetStakeEvent';
  numSpaceships: string;
  stake: string;
};

export type PlanetExitEvent = PlanetEvent & {
  __typename: 'PlanetExitEvent';
  exitTime: string;
  stake: string;
};

export type FleetArrivedEvent = PlanetEvent & {
  __typename: 'FleetArrivedEvent';
  fleetLoss: string;
  planetLoss: string;
  inFlightFleetLoss: string;
  inFlightPlanetLoss: string;
  destinationOwner: {id: string};
  fleet: {id: string};
  from: {id: string};
  won: boolean;
  quantity: string;
  planet: {id: string};
  newNumspaceships: string;
};

export type FleetSentEvent = PlanetEvent & {
  __typename: 'FleetSentEvent';
  fleet: {id: string};
  quantity: string;
};
