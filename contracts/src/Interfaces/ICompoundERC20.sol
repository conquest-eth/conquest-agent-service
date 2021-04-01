// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICompoundERC20 is IERC20 {
    function mint(uint256) external returns (uint256);

    function exchangeRateCurrent() external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function redeem(uint256) external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);
}
