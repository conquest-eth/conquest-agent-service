// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";

interface YearnVaultV2 is IERC20 {
    function deposit(uint256 amount) external returns (uint256);

    function withdraw(uint256 amount, address to) external returns (uint256);

    function totalAssets() external view returns (uint256);

    function pricePerShare() external view returns (uint256);
}

abstract contract YearnVaultV2Adapter is BaseInternal {
    using SafeERC20 for IERC20;

    YearnVaultV2 immutable _yvToken;
    IERC20 immutable _underlyingToken;

    constructor(IERC20 underlyingToken, YearnVaultV2 yvToken) {
        _underlyingToken = underlyingToken;
        _yvToken = yvToken;
        underlyingToken.approve(address(yvToken), Constants.UINT256_MAX);
    }

    function _use(uint256 maxAmount, address from) internal returns (uint256) {
        if (from != address(this)) {
            _underlyingToken.safeTransferFrom(from, address(this), maxAmount);
        }
        _yvToken.deposit(maxAmount);
        return maxAmount;
    }

    function _takeBack(uint256 maxAmount, address to) internal returns (uint256) {
        uint256 sharesToWithdraw = _shareForUnderlyingAmount(maxAmount); // TODO
        return _yvToken.withdraw(sharesToWithdraw, to);
    }

    function _withdrawInterest(uint256 maxAmount, address to) internal returns (uint256) {
        uint256 totalUnderlying = _underlyingTokenAvailable();
        uint256 availableToWithdraw = totalUnderlying - _internal_totalSupply();
        if (maxAmount > availableToWithdraw) {
            maxAmount = availableToWithdraw;
        }
        uint256 sharesToWithdraw = _shareForUnderlyingAmount(maxAmount); // TODO
        return _yvToken.withdraw(sharesToWithdraw, to);
    }

    function _shareForUnderlyingAmount(uint256 underlyingAmount) internal view returns (uint256) {
        // uint256 totalAssets = _yvToken.totalAssets();
        // if (totalAssets > 0) {
        //     return (underlyingAmount * _yvToken.totalSupply()) / totalAssets;
        // } else {
        //     return 0;
        // }

        uint256 valuePerShare = _yvToken.pricePerShare();
        if (valuePerShare > 0) {
            return (underlyingAmount * 1000000000000000000) / valuePerShare;
        }
        return 0;
    }

    function _underlyingTokenAvailable() internal view returns (uint256) {
        return _yvToken.totalAssets();
    }
}
