export type Env = {
  REVEAL_QUEUE: DurableObjectNamespace;
  ENVIRONMENT: 'dev' | 'staging' | 'production';
  ETHEREUM_NODE: string;
  PRIVATE_KEY: string;
  FINALITY?: string;
  DATA_DOG_API_KEY: string;
};

export type CronTrigger = {cron: string; scheduledTime: number};
