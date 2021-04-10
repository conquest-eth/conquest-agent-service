import contractsInfo from '$lib/contracts.json';

export let contracts = contractsInfo;

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // console.log('updated: implementation is now ', newModule.contracts.contracts.OuterSpace_Implementation.address);
    contracts = newModule.contracts;
  });
}
