// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../Interfaces/ICompoundERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";

interface AaveLendingPool {
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external;
}

abstract contract AaveAdapter is BaseInternal {
    using SafeERC20 for IERC20;

    AaveLendingPool immutable _aaveLendingPool;
    IERC20 immutable _aToken;
    IERC20 immutable _underlyingToken;

    constructor(
        IERC20 underlyingToken,
        AaveLendingPool aaveLendingPool,
        IERC20 aToken
    ) {
        _underlyingToken = underlyingToken;
        _aaveLendingPool = aaveLendingPool;
        _aToken = aToken;
        underlyingToken.approve(address(aaveLendingPool), Constants.UINT256_MAX);
        aToken.approve(address(aaveLendingPool), Constants.UINT256_MAX);
    }

    function _use(uint256 amount, address from) internal {
        if (from != address(this)) {
            _underlyingToken.safeTransferFrom(from, address(this), amount);
        }
        _aaveLendingPool.deposit(address(_underlyingToken), amount, address(this), 0);
    }

    function _takeBack(uint256 amount, address to) internal {
        _aaveLendingPool.withdraw(address(_underlyingToken), amount, to);
    }

    function _withdrawInterest(uint256 upToUnderlyingAmount, address to) internal returns (uint256) {
        uint256 aTokenBalance = _aToken.balanceOf(address(this));
        uint256 availableToWithdraw = aTokenBalance - _internal_totalSupply();
        if (upToUnderlyingAmount > availableToWithdraw) {
            upToUnderlyingAmount = availableToWithdraw;
        }
        _aaveLendingPool.withdraw(address(_underlyingToken), upToUnderlyingAmount, to);
        return upToUnderlyingAmount;
    }
}
