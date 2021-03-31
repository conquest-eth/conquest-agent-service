// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";
import "./WithOwner.sol";

interface Adapter {
    function use(uint256 amount, address from) external;

    function takeBack(uint256 amount, address to) external;

    function withdrawInterest(uint256 upToUnderlyingAmount, address to) external returns (uint256);

    function withdrawAllTo(address to) external returns (uint256);
}

abstract contract DyynamicAdapter is BaseInternal, WithOwner {
    using SafeERC20 for IERC20;

    event AdapterUpdated(Adapter newAdapter);

    Adapter internal _currentAdapter;

    constructor(Adapter initialAdapter, address) {
        _currentAdapter = initialAdapter;
        emit AdapterUpdated(initialAdapter);
    }

    function setAdapter(Adapter newAdapter) external onlyOwner {
        Adapter oldAdapter = _currentAdapter;
        uint256 amount = oldAdapter.withdrawAllTo(address(newAdapter));
        newAdapter.use(amount, address(newAdapter));
        _currentAdapter = newAdapter;
        emit AdapterUpdated(newAdapter);
    }

    function _use(uint256 amount, address from) internal {
        _currentAdapter.use(amount, from);
    }

    function _takeBack(uint256 amount, address to) internal {
        _currentAdapter.takeBack(amount, to);
    }

    function _withdrawInterest(uint256 upToUnderlyingAmount, address to) internal returns (uint256) {
        return _currentAdapter.withdrawInterest(upToUnderlyingAmount, to);
    }
}
