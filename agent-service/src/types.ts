export type Env = {
  REVEAL_QUEUE: DurableObjectNamespace;
  ENVIRONMENT: 'dev' | 'staging' | 'production';
  ETHEREUM_NODE: string;
  PRIVATE_KEY: string;
  FINALITY?: string;
};

export type CronTrigger = {cron: string; scheduledTime: number};
