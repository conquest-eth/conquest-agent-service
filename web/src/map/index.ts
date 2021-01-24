import type {Renderer} from './renderer';
import type {Camera} from './camera';
import {Controller} from './controller';

export default class Map {
  public renderer: Renderer;
  public camera: Camera;
  constructor(renderer: Renderer, camera: Camera) {
    this.renderer = renderer;
    this.camera = camera;
  }
  setup(canvas: HTMLCanvasElement): () => void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    let ctx: CanvasRenderingContext2D = canvas.getContext(
      '2d'
    ) as CanvasRenderingContext2D;
    if (!ctx) {
      throw new Error(`cannot create 2d context`);
    }
    this.renderer.setup(ctx);

    const draw = (time: number) => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = this.camera.render.scale;
      ctx.scale(scale, scale);
      ctx.translate(this.camera.render.x, this.camera.render.y);

      this.renderer.render(time, ctx, this.camera.world, this.camera.render);
      ctx.restore();
    };

    this.camera.setup({canvas, controller: new Controller(canvas)});

    let frame: number;
    (function loop(time: number) {
      frame = requestAnimationFrame(loop);
      self.camera.onRender();
      draw(time);
    })(performance.now());
    return () => {
      cancelAnimationFrame(frame);
    };
  }
}
