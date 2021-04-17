import type {OwnFleet, Planet} from 'conquest-eth-common';
import PlanetInfoPanel from '$lib/components/PlanetInfoPanel.svelte';
import type {UI} from '$lib/app/UI';

export class Controller {
  private planetInfoComponent: PlanetInfoPanel | undefined;
  public selectedPlanet: string | undefined;
  constructor(private ui: UI) {
    this.ui.onBeforeAllDeleted(() => {
      this.hidePlanetInfo();
    });
    this.planetInfoComponent = undefined;
  }

  onPlanetSelected(planet?: Planet): void {
    if (planet) {
      this.selectedPlanet = planet.location.id;
      this.showPlanetInfo(planet);
    } else {
      this.selectedPlanet = undefined;
      this.hidePlanetInfo();
    }
  }

  onFleetSelected(fleet: OwnFleet): void {
    // console.log({fleet});
  }

  showPlanetInfo(planet: Planet): void {
    if (!this.ui.elem) {
      console.error(`no ui elem`);
      return;
    }
    // console.log('show');
    if (this.planetInfoComponent) {
      this.hidePlanetInfo();
    }
    // console.log('create');
    this.planetInfoComponent = new PlanetInfoPanel({
      target: this.ui.elem,
      props: {
        location: planet.location.id,
        close: () => this.hidePlanetInfo(),
      },
    });
  }

  hidePlanetInfo(): void {
    // console.log('hide');
    if (this.planetInfoComponent) {
      // console.log('destroy');
      this.planetInfoComponent.$destroy();
      this.planetInfoComponent = undefined;
    }
  }
}
