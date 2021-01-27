import {hookup} from 'named-logs-console';
import {
  getParamsFromURL,
  getParamsFromURLHash,
  // rebuildLocationHash,
} from './lib/utils/web';
hookup();

window.params = getParamsFromURL();
window.hashParams = getParamsFromURLHash();

// if (window.hashParams.clearLocalStorage) {
//   delete window.hashParams.clearLocalStorage;
//   rebuildLocationHash(window.hashParams);
//   localStorage.clear();
// }
