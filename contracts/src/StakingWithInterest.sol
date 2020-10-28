pragma solidity 0.6.5;

import "./Interfaces/ERC20.sol";

contract StakingWithInterest {
    ERC20 immutable _stakingToken;

    constructor(ERC20 stakingToken) internal {
        _stakingToken = stakingToken;
    }

    function _deposit(uint256 amount) internal {}

    function _refund(uint256 amount) internal {}

    function _withdraw(uint256 amount) internal {}
}
