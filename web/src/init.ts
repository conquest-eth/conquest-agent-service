import {hookup} from 'named-logs-console';
import {
  getParamsFromURL,
  getParamsFromURLHash,
  // rebuildLocationHash,
} from './lib/utils/web';
hookup();

window.params = getParamsFromURL();
window.hashParams = getParamsFromURLHash();
window.startTime = Math.floor(Date.now() / 1000);

console.log({startTime: window.startTime});

// if (window.hashParams.clearLocalStorage) {
//   delete window.hashParams.clearLocalStorage;
//   rebuildLocationHash(window.hashParams);
//   localStorage.clear();
// }
