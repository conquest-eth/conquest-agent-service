import {BaseStoreWithData} from '$lib/utils/stores/base';

type Data = {
  to: {x: number; y: number};
  from: {x: number; y: number};
};

export type SimulateFlow = {
  type: 'SEND';
  step: 'IDLE' | 'PICK_DESTINATION' | 'SIMULATE';
  data?: Data;
  error?: {message?: string};
};

class SimulateFlowStore extends BaseStoreWithData<SimulateFlow, Data> {
  constructor() {
    super({
      type: 'SEND',
      step: 'IDLE',
    });
  }

  async simulateFrom(from: {x: number; y: number}): Promise<void> {
    this.setData({from}, {step: 'PICK_DESTINATION'});
  }

  async simulate(to: {x: number; y: number}) {
    this.setData({to}, {step: 'SIMULATE'});
  }

  async cancel(): Promise<void> {
    this._reset();
  }

  async acknownledgeSuccess(): Promise<void> {
    this._reset();
  }

  async acknownledgeError(): Promise<void> {
    this.setPartial({error: undefined});
  }

  private _reset() {
    this.setPartial({step: 'IDLE', data: undefined});
  }
}

export default new SimulateFlowStore();
