export class UI {
  private onBeforeCallbacks: (() => void)[] = [];
  public elem: Element | undefined;
  constructor() {}

  setCanvas(canvas: HTMLCanvasElement): void {
    if (!this.elem) {
      const parent = canvas.parentNode as Element;
      this.elem = document.createElement('div');
      parent.appendChild(this.elem);
    }
    // TODO else error ?
  }

  hideAll(): void {
    for (const callback of this.onBeforeCallbacks) {
      callback();
    }
    if (!this.elem) {
      return;
    }
    while (this.elem.hasChildNodes()) {
      console.log('child to remove:', this.elem.lastChild);
      this.elem.removeChild(this.elem.lastChild);
    }
  }

  onBeforeAllDeleted(func: () => void): void {
    this.onBeforeCallbacks.push(func);
  }
}
