import {xyToLocation} from 'conquest-eth-common';
import {BigNumber} from 'ethers';

const location = xyToLocation(-46, 51);

const bn = BigNumber.from(location);

console.log(bn.toString());
