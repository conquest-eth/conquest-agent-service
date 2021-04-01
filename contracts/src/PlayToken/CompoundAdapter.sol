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

    function _use(uint256 maxAmount, address from) internal returns (uint256) {
        if (from != address(this)) {
            _underlyingToken.safeTransferFrom(from, address(this), maxAmount);
        }
        require(_cToken.mint(maxAmount) == 0, "ERROR_MINT");
        return maxAmount; //TODO check ?
    }

    function _takeBack(uint256 maxAmount, address to) internal returns (uint256) {
        require(_cToken.redeemUnderlying(maxAmount) == 0, "ERROR_REDEEM_UNDERLYING");
        _underlyingToken.safeTransfer(to, maxAmount);
        return maxAmount;
    }

    function _withdrawInterest(uint256 maxAmount, address to) internal returns (uint256) {
        uint256 totalUnderlying = _underlyingTokenAvailable();
        uint256 availableToWithdraw = totalUnderlying - _internal_totalSupply();
        if (maxAmount > availableToWithdraw) {
            maxAmount = availableToWithdraw;
        }
        require(_cToken.redeemUnderlying(maxAmount) == 0, "ERROR_REDEEM_UNDERLYING");
        _underlyingToken.safeTransfer(to, maxAmount);
        return maxAmount;
    }

    function _underlyingTokenAvailable() internal view returns (uint256) {
        uint256 compoundBalance = _cToken.balanceOf(address(this));
        uint256 exchangeRateMantissa = _cToken.exchangeRateCurrent();
        return (compoundBalance * exchangeRateMantissa) / Constants.DECIMALS_18;
    }
}
