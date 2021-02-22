// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../Interfaces/ICompoundERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";

abstract contract CompoundAdapter is BaseInternal {
    using SafeERC20 for IERC20;

    ICompoundERC20 immutable _cToken;
    IERC20 immutable _underlyingToken;

    constructor(IERC20 underlyingToken, ICompoundERC20 cToken) {
        _underlyingToken = underlyingToken;
        _cToken = cToken;
        underlyingToken.approve(address(cToken), Constants.UINT256_MAX);
    }

    function _use(uint256 amount, address from) internal {
        _underlyingToken.safeTransferFrom(from, address(this), amount);
        require(_cToken.mint(amount) == 0, "ERROR_MINT");
    }

    function _takeBack(uint256 amount, address to) internal {
        require(_cToken.redeemUnderlying(amount) == 0, "ERROR_REDEEM_UNDERLYING");
        _underlyingToken.safeTransfer(to, amount);
    }

    function _withdrawInterest(uint256 upToUnderlyingAmount, address to) internal returns (uint256) {
        uint256 compoundBalance = _cToken.balanceOf(address(this));
        uint256 exchangeRateMantissa = _cToken.exchangeRateCurrent();
        uint256 totalUnderlying = (compoundBalance * exchangeRateMantissa) / Constants.DECIMALS_18;
        uint256 availableToWithdraw = totalUnderlying - _internal_totalSupply();
        if (upToUnderlyingAmount > availableToWithdraw) {
            upToUnderlyingAmount = availableToWithdraw;
        }
        require(_cToken.redeemUnderlying(upToUnderlyingAmount) == 0, "ERROR_REDEEM_UNDERLYING");
        _underlyingToken.safeTransfer(to, upToUnderlyingAmount);
        return upToUnderlyingAmount;
    }
}
