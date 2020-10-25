import PlanetInfo from '../components/PlanetInfo.svelte';

export class Controller {
  constructor(canvas) {
    this.canvas = canvas.parentNode;
    this.planetInfoComponent = null;
  }
  onPlanetSelected(planet) {
    if (planet) {
      this.showPlanetInfo(planet);
    } else {
      this.hidePlanetInfo();
    }
  }

  showPlanetInfo(planet) {
    console.log('show');
    if (this.planetInfoComponent) {
      this.hidePlanetInfo();
    }
    console.log('create');
    this.planetInfoComponent = new PlanetInfo({
      target: this.canvas,
      props: {
        planet,
      },
    });
  }

  hidePlanetInfo() {
    console.log('hide');
    if (this.planetInfoComponent) {
      console.log('destroy');
      this.planetInfoComponent.$destroy();
      this.planetInfoComponent = null;
    }
  }
}
