import {BaseStoreWithData} from '$lib/utils/stores';

type Data = {
  txHash?: string;
  location: {x: number; y: number};
};
export type MessageFlow = {
  type: 'MESSAGE';
  step: 'IDLE' | 'SHOW';
  owner?: string;
  error?: {message?: string};
};

class MessageFlowStore extends BaseStoreWithData<MessageFlow, Data> {
  public constructor() {
    super({
      type: 'MESSAGE',
      step: 'IDLE',
    });
  }

  async show(owner: string): Promise<void> {
    this.setPartial({step: 'SHOW', owner});
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
    this.setPartial({step: 'IDLE', owner: undefined});
  }
}

export default new MessageFlowStore();
