import {base} from '$app/paths';
import {contractsInfos} from '$lib/blockchain/contractsInfos';

class LStorage {
  private _prefix: string;
  constructor(version?: string) {
    this._prefix = (base && base.startsWith('/ipfs/')) || base.startsWith('/ipns/') ? base.slice(6) : '_c_'; // ensure local storage is not conflicting across web3w-based apps on ipfs gateways (require encryption for sensitive data)

    const lastVersion = this.getItem('_version');
    if (lastVersion !== version) {
      console.log('new version, clear old storage...', {lastVersion, version});
      this.clear();
      if (version) {
        this.setItem('_version', version);
      }
    }
  }
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(this._prefix + key, value);
    } catch (e) {
      //
    }
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(this._prefix + key);
    } catch (e) {
      return null;
    }
  }

  removeItem(key: string) {
    try {
      localStorage.removeItem(this._prefix + key);
    } catch (e) {
      //
    }
  }

  clear(): void {
    try {
      const l = localStorage.length;
      for (let i = 0; i < l; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this._prefix)) {
          console.log(`removing ${key}...`);
          this.removeItem(key);
        }
      }
    } catch (e) {}
  }
}

export default new LStorage(
  contractsInfos.contracts.OuterSpace.address + contractsInfos.contracts.OuterSpace.linkedData.chainGenesisHash
    ? ':' + contractsInfos.contracts.OuterSpace.linkedData.chainGenesisHash
    : ''
);
