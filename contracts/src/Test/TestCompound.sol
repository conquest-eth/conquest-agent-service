// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "../Interfaces/ICompoundERC20.sol";
import "../PlayToken/Base.sol";
import "../Libraries/Constants.sol";

contract TestCompound is Base, ICompoundERC20 {
    constructor() {}

    function name() public pure override returns (string memory) {
        return "CTOKEN";
    }

    function mint(uint256) external override returns (uint256) {
        return 0; // TODO
    }

    function exchangeRateCurrent() external view override returns (uint256) {
        return Constants.DECIMALS_18;
    }

    function supplyRatePerBlock() external view override returns (uint256) {
        return 0; // TODO
    }

    function redeem(uint256) external override returns (uint256) {
        return 0; // TODO
    }

    function redeemUnderlying(uint256) external override returns (uint256) {
        return 0; // TODO
    }
}
