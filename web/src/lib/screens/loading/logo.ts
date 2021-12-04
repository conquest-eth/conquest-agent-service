import {BaseStore} from '$lib/utils/stores/base';
import {now} from '$lib/time';
import lstorage from '$lib/utils/lstorage';
import {params} from '$lib/config';

class LogoStore extends BaseStore<{stage: number}> {
  private stageTime: number;
  private timeout: number | undefined;
  private visited: boolean;

  constructor() {
    const result = lstorage.getItem('_conquest_visited');
    const visited = result === 'true';
    super({stage: visited ? 1 : 0});
    this.stageTime = now();
    this.visited = visited;
  }

  start() {
    this.stageTime = now();
  }

  gameLogoReady() {
    this.visited ? this._loaded(2) : this._loaded(5);
  }

  etherplayLogoReady() {
    this._loaded(2);
  }

  _loaded(timeIn: number) {
    const diff = now() - this.stageTime;
    if (diff > timeIn) {
      if (!params['logo']) {
        this.nextStage();
      }
    } else {
      if (!params['logo']) {
        this.timeout = setTimeout(() => this.nextStage(), (timeIn - diff) * 1000) as unknown as number;
      }
    }
  }

  nextStage() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.stageTime = now();
    this.set({stage: this.$store.stage + 1});
    if (this.$store.stage === 2) {
      lstorage.setItem('_conquest_visited', 'true');
    }
  }
}

export const logo = new LogoStore();
