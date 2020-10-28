import type {PlanetData} from 'planet-wars-common';
import PlanetInfo from '../components/PlanetInfo.svelte';

export class Controller {
  private parent: Element;
  private planetInfoComponent: PlanetInfo;
  constructor(canvas: HTMLCanvasElement) {
    this.parent = canvas.parentNode as Element;
    this.planetInfoComponent = null;
  }
  onPlanetSelected(planet: PlanetData): void {
    if (planet) {
      this.showPlanetInfo(planet);
    } else {
      this.hidePlanetInfo();
    }
  }

  showPlanetInfo(planet: PlanetData): void {
    console.log('show');
    if (this.planetInfoComponent) {
      this.hidePlanetInfo();
    }
    console.log('create');
    this.planetInfoComponent = new PlanetInfo({
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
