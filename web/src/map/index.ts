import type {Renderer} from './renderer';
import type {Camera} from './camera';
import {Controller} from './controller';

const drawOnChange = true;

export default class Map {
  public renderer;
  public camera;
  constructor(renderer: Renderer, camera: Camera) {
    this.renderer = renderer;
    this.camera = camera;
  }
  setup(canvas: HTMLCanvasElement): () => void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const ctx = canvas.getContext('2d');
    this.renderer.setup(ctx);

    const draw = () => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = this.camera.render.scale;
      ctx.scale(scale, scale);
      ctx.translate(this.camera.render.x, this.camera.render.y);

      this.renderer.render(ctx, this.camera.world);
      ctx.restore();
    };

    this.camera.setup({canvas, controller: new Controller(canvas)}, () => {
      if (drawOnChange) draw();
    });

    let frame;
    (function loop() {
      frame = requestAnimationFrame(loop);
      if (self.camera.onRender() || !drawOnChange) {
        draw();
      }
    })();
    return () => {
      cancelAnimationFrame(frame);
    };
  }
}
