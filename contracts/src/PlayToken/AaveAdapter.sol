// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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

    function _use(uint256 maxAmount, address from) internal returns (uint256) {
        if (from != address(this)) {
            _underlyingToken.safeTransferFrom(from, address(this), maxAmount);
        }
        _aaveLendingPool.deposit(address(_underlyingToken), maxAmount, address(this), 0);
        return maxAmount; // TODO check
    }

    function _takeBack(uint256 maxAmount, address to) internal returns (uint256) {
        _aaveLendingPool.withdraw(address(_underlyingToken), maxAmount, to);
        return maxAmount; // TODO check
    }

    function _withdrawInterest(uint256 maxAmount, address to) internal returns (uint256) {
        uint256 totalUnderlying = _underlyingTokenAvailable();
        uint256 availableToWithdraw = totalUnderlying - _internal_totalSupply();
        if (maxAmount > availableToWithdraw) {
            maxAmount = availableToWithdraw;
        }
        _aaveLendingPool.withdraw(address(_underlyingToken), maxAmount, to);
        return maxAmount; // TODO check ?
    }

    function _underlyingTokenAvailable() internal view returns (uint256) {
        return _aToken.balanceOf(address(this));
    }
}
