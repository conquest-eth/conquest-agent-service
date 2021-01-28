/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function hmrClass<T extends {new (...args: any[]): {}}>(
  constructor: T
): T | undefined {
  if (import.meta.hot) {
    return class extends constructor {
      static __instances: any[] = [];
      constructor(...args: any[]) {
        console.log('adding');
        super(...args);
        (this.constructor as any).__instances.push(this);
      }
    };
  }
}
