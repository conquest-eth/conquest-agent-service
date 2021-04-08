import type {OwnFleet, Planet} from '$lib/common/src/types';
import PlanetInfoPanel from '$lib/components/PlanetInfoPanel.svelte';

export class Controller {
  private parent: Element;
  private planetInfoComponent: PlanetInfoPanel | undefined;
  public selectedPlanet: string | undefined;
  constructor(canvas: HTMLCanvasElement) {
    this.parent = canvas.parentNode as Element;
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
    // console.log('show');
    if (this.planetInfoComponent) {
      this.hidePlanetInfo();
    }
    // console.log('create');
    this.planetInfoComponent = new PlanetInfoPanel({
      target: this.parent,
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
