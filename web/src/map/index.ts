import type {Renderer} from './renderer';
import type {Camera} from './camera';
import {Controller} from './controller';

export default class Map {
  public renderer: Renderer;
  public camera: Camera;
  protected pendingFrame: number | undefined;
  protected ctx: CanvasRenderingContext2D = (undefined as unknown) as CanvasRenderingContext2D; // force type as setup is required to be called
  protected canvas: HTMLCanvasElement = (undefined as unknown) as HTMLCanvasElement; // force type as setup is required to be called
  constructor(renderer: Renderer, camera: Camera) {
    this.renderer = renderer;
    this.camera = camera;
  }

  // TODO use constructor ?
  setup(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    const ctx: CanvasRenderingContext2D = canvas.getContext(
      '2d'
    ) as CanvasRenderingContext2D;
    if (!ctx) {
      throw new Error(`cannot create 2d context`);
    }
    this.ctx = ctx;
    const controller = new Controller(canvas);
    this.renderer.setup(this.ctx, controller);
    this.camera.setup({
      canvas: this.canvas,
      controller,
    });

    this._loop(performance.now());
    this.camera.initZoom();
    return this.startRendering();
  }

  startRendering(): () => void {
    this.pendingFrame = requestAnimationFrame((t) => this._loop(t));
    return () => {
      if (this.pendingFrame) {
        cancelAnimationFrame(this.pendingFrame);
      }
    };
  }

  protected _loop(time: number): void {
    this.camera.onRender();
    this._draw(time);
    this.pendingFrame = requestAnimationFrame((t) => this._loop(t));
  }

  protected _draw(time: number): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const scale = this.camera.render.scale;
    this.ctx.scale(scale, scale);
    this.ctx.translate(this.camera.render.x, this.camera.render.y);

    this.renderer.render(time, this.ctx, this.camera.world, this.camera.render);
    this.ctx.restore();
  }
}
