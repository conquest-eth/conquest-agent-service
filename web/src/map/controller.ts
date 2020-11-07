import type {Planet} from 'planet-wars-common';
import PlanetInfoPanel from '../components/PlanetInfoPanel.svelte';

export class Controller {
  private parent: Element;
  private planetInfoComponent: PlanetInfoPanel;
  constructor(canvas: HTMLCanvasElement) {
    this.parent = canvas.parentNode as Element;
    this.planetInfoComponent = null;
  }
  onPlanetSelected(planet: Planet): void {
    if (planet) {
      this.showPlanetInfo(planet);
    } else {
      this.hidePlanetInfo();
    }
  }

  showPlanetInfo(planet: Planet): void {
    console.log('show');
    if (this.planetInfoComponent) {
      this.hidePlanetInfo();
    }
    console.log('create');
    this.planetInfoComponent = new PlanetInfoPanel({
      target: this.parent,
      props: {
        planet,
      },
    });
  }

  hidePlanetInfo(): void {
    console.log('hide');
    if (this.planetInfoComponent) {
      console.log('destroy');
      this.planetInfoComponent.$destroy();
      this.planetInfoComponent = null;
    }
  }
}
