import type {OwnFleet, Planet} from 'conquest-eth-common';
import selection from '$lib/stores/selection';

export class Controller {
  get selectedPlanet(): string | undefined {
    return selection.id;
  }

  onPlanetSelected(planet?: Planet): void {
    if (planet) {
      selection.select(planet.location.id);
    } else {
      selection.unselect();
    }
  }

  onFleetSelected(fleet: OwnFleet): void {
    // console.log({fleet});
  }
}
