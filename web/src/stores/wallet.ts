import WalletStores from 'web3w';
import {WalletConnectModuleLoader} from 'web3w-walletconnect-loader';
import contractsInfo from '../contracts.json';
import {notifications} from './notifications';
import {finality, nodeUrl, chainId} from '../config';

const walletStores = WalletStores({
  chainConfigs: contractsInfo,
  builtin: {autoProbe: true},
  transactions: {
    autoDelete: true,
    finality,
  },
  localStoragePrefix:
    window.basepath &&
    (window.basepath.startsWith('/ipfs/') ||
      window.basepath.startsWith('/ipns/'))
      ? window.basepath.slice(6)
      : undefined, // ensure local storage is not conflicting across web3w-based apps on ipfs gateways
  options: [
    'builtin',
    new WalletConnectModuleLoader({
      nodeUrl,
      chainId,
      infuraId: 'bc0bdd4eaac640278cdebc3aa91fabe4',
    }),
  ],
  fallbackNode: nodeUrl, // TODO use query string to specify it // TODO settings
});

export const {
  wallet,
  transactions,
  builtin,
  chain,
  balance,
  flow,
  fallback,
} = walletStores;

function notifyFailure(tx: {hash: string}) {
  notifications.queue({
    id: tx.hash,
    delay: 0,
    title: 'Transaction Error',
    text: 'The Transaction failed',
    type: 'error',
    onAcknowledge: () => transactions.acknowledge(tx.hash, 'failure'),
  });
}

function notifyCancelled(tx: {hash: string}) {
  notifications.queue({
    id: tx.hash,
    delay: 3,
    title: 'Transaction Cancelled',
    text: 'The Transaction Has Been Replaced',
    type: 'info',
    onAcknowledge: () => transactions.acknowledge(tx.hash, 'cancelled'),
  });
}

transactions.subscribe(($transactions) => {
  for (const tx of $transactions.concat()) {
    if (tx.confirmations > 0 && !tx.acknowledged) {
      if (tx.status === 'failure') {
        notifyFailure(tx);
      } else if (tx.status === 'cancelled') {
        notifyCancelled(tx);
      } else {
        // auto acknowledge
        transactions.acknowledge(tx.hash, tx.status);
      }
    }
  }
});
