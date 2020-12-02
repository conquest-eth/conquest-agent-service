// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakingWithInterest {
    IERC20 immutable _stakingToken;

    constructor(IERC20 stakingToken) {
        _stakingToken = stakingToken;
    }

    function _deposit(uint256 amount) internal {}

    function _refund(uint256 amount) internal {}

    function _withdraw(uint256 amount) internal {}
}
