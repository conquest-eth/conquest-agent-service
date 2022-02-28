import {writable} from 'svelte/store';

let pluginList = [];
if (typeof localStorage !== `undefined`) {
  const strFromStorage = localStorage.getItem(`plugins`);
  if (strFromStorage) {
    pluginList = JSON.parse(strFromStorage);
  }
}
const store = writable(pluginList);

export default store;

store.subscribe((newValue) => {
  if (typeof localStorage !== `undefined`) {
    localStorage.setItem(`plugins`, JSON.stringify(newValue));
  }
});
