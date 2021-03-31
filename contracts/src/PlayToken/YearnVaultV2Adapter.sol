// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";

interface YearnVaultV2 is IERC20 {
    function deposit(uint256 amount) external returns (uint256);

    function withdraw(uint256 amount, address to) external returns (uint256);
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

    function _use(uint256 amount, address from) internal returns (uint256) {
        if (from != address(this)) {
            _underlyingToken.safeTransferFrom(from, address(this), amount);
        }
        _yvToken.deposit(amount);
        return amount;
    }

    function _takeBack(uint256 amount, address to) internal returns (uint256) {
        uint256 yvShares = _yvToken.balanceOf(address(this));

        uint256 shareToWithdrawToGetAmount = yvShares + amount; // TODO

        return _yvToken.withdraw(shareToWithdrawToGetAmount, to); // TODO check it cannot return higher than amount, else should we bring it back ?
    }

    function _withdrawInterest(uint256 upToUnderlyingAmount, address to) internal returns (uint256) {
        uint256 yvShares = _yvToken.balanceOf(address(this));
        uint256 underlyingTokenAmount = yvShares; // TODO

        uint256 availableToWithdraw = underlyingTokenAmount - _internal_totalSupply();
        if (upToUnderlyingAmount > availableToWithdraw) {
            upToUnderlyingAmount = availableToWithdraw;
        }
        uint256 sharesToWithdraw = yvShares; // TODO
        return _yvToken.withdraw(sharesToWithdraw, to); // TODO check it cannot return higher than amount, else should we bring it back ?
    }
}
