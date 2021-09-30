import {AutoStartBaseStore} from '$lib/utils/stores/base';
import {wallet} from '$lib/blockchain/wallet';
import {AGENT_SERVICE_URL, mediumFrequencyFetch} from '$lib/config';
import type {WalletStore} from 'web3w';
import {BigNumber} from '@ethersproject/bignumber';
import {privateWallet} from './privateWallet';

type Position = {x: number; y: number};

type AgentServiceAccountData = {
  balance: BigNumber;
  delegate?: string;
  nonceMsTimestamp: number;
  requireTopUp: boolean;
  minimumBalance: string;
};

type AgentServiceState = {
  state: 'Idle' | 'Loading' | 'Ready';
  error?: {code: number; message: string};
  account?: AgentServiceAccountData;
};

class AgentServiceStore extends AutoStartBaseStore<AgentServiceState> {
  _timeout: NodeJS.Timeout;
  _stopped: boolean;
  _lastWallet?: string;
  _unsubscribeFromWallet?: () => void;

  async submitReveal(
    fleetID: string,
    secret: string,
    from: Position,
    to: Position,
    distance: number,
    startTime: number,
    duration: number
  ): Promise<{queueID: string}> {
    const revealSubmission = {
      player: wallet.address.toLowerCase(),
      fleetID,
      secret,
      from,
      to,
      distance,
      startTime,
      duration,
      nonceMsTimestamp: Math.floor(Date.now()),
    };
    const queueMessageString = `queue:${revealSubmission.player}:${fleetID}:${secret}:${from.x}:${from.y}:${to.x}:${to.y}:${distance}:${startTime}:${duration}:${revealSubmission.nonceMsTimestamp}`;
    const queueSignature = await privateWallet.signer.signMessage(queueMessageString);
    const data = {...revealSubmission, signature: queueSignature, delegate: privateWallet.signer.address.toLowerCase()};
    const response = await fetch(`${AGENT_SERVICE_URL}/queueReveal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  constructor() {
    super({state: 'Idle'});
  }

  triggerUpdate() {
    this._clearTimeoutIfAny();
    this._check();
  }

  acknowledgeError(): void {
    this.setPartial({error: undefined});
  }

  _onStart() {
    this._stopped = false;
    this._unsubscribeFromWallet = wallet.subscribe(this._onWallet.bind(this));
    this.setPartial({state: 'Loading'});
    this._check();
    return this._stop.bind(this);
  }

  _clearTimeoutIfAny() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }
  }

  _stop() {
    if (this._unsubscribeFromWallet) {
      this._unsubscribeFromWallet();
      this._unsubscribeFromWallet = undefined;
    }
    this._clearTimeoutIfAny();
    this._stopped = true;
  }

  _onWallet($wallet: WalletStore) {
    if (this._lastWallet != $wallet.address) {
      this._lastWallet = $wallet.address;
      this._clearTimeoutIfAny();
      this._check();
    }
  }

  async _check() {
    try {
      if (this._lastWallet) {
        const response = await fetch(`${AGENT_SERVICE_URL}/account/${this._lastWallet}`);
        const {account} = (await response.json()) as {
          account?: {
            balance: string;
            delegate?: string;
            nonceMsTimestamp: number;
            requireTopUp: boolean;
            minimumBalance: string;
          };
        };
        this.setPartial({
          state: 'Ready',
          account: account
            ? {
                balance: BigNumber.from(account.balance),
                delegate: account.delegate,
                nonceMsTimestamp: account.nonceMsTimestamp,
                requireTopUp: account.requireTopUp,
                minimumBalance: account.minimumBalance,
              }
            : undefined,
        });
      } else {
        this.setPartial({
          state: 'Ready',
          account: undefined,
        });
      }
    } catch (e) {
      console.error(e);
    }

    if (!this._stopped) {
      this._timeout = setTimeout(this._check.bind(this), mediumFrequencyFetch * 1000);
    }
  }
}

export const agentService = new AgentServiceStore();
