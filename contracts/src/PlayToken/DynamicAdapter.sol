// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";
import "./WithOwner.sol";

interface Adapter {
    function underlyingTokenAvailable() external view returns (uint256); // TODO implement in adapter

    function use(uint256 maxAmount, address from) external returns (uint256);

    function takeBack(uint256 maxAmount, address to) external returns (uint256);

    function withdrawInterest(uint256 maxAmount, address to) external returns (uint256);

    function withdrawAllTo(address to) external returns (uint256);

    function withdrawWhatIsLeft(address to) external returns (uint256); // TODO implement in adapter
}

abstract contract DyynamicAdapter is BaseInternal, WithOwner {
    using SafeERC20 for IERC20;

    event AdapterUpdated(Adapter newAdapter);

    Adapter internal _currentAdapter;
    IERC20 immutable _underlyingToken;

    constructor(
        IERC20 underlyingToken,
        Adapter initialAdapter,
        address
    ) {
        _underlyingToken = underlyingToken;
        _currentAdapter = initialAdapter;
        emit AdapterUpdated(initialAdapter);
    }

    function switchAdapter(Adapter newAdapter) external onlyOwner {
        Adapter oldAdapter = _currentAdapter;
        uint256 amount = oldAdapter.withdrawAllTo(address(newAdapter));
        newAdapter.use(amount, address(newAdapter));
        _currentAdapter = newAdapter;
        emit AdapterUpdated(newAdapter);
    }

    function _use(uint256 maxAmount, address from) internal returns (uint256) {
        return _currentAdapter.use(maxAmount, from);
    }

    function _underlyingTokenAmountForTokenAmount(Adapter adapter, uint256 amount) internal view returns (uint256) {
        uint256 expectedAmount = _internal_totalSupply();
        uint256 underlyingTokenAvailable = adapter.underlyingTokenAvailable();
        if (underlyingTokenAvailable < expectedAmount) {
            // if the underlying tokens get missing we adjust the amount for everyone to match the ratio
            // This should only happen if the adapter default and cannot provide the underlying token back.
            // this ensure the cost is spread over all present and future owners of the token.
            // if the switching of adapter is prevented when that amount is not equal, this cannot happen
            return (amount * underlyingTokenAvailable) / expectedAmount;
        }
        return amount;
    }

    function _takeBack(uint256 maxAmount, address to) internal returns (uint256) {
        Adapter adapter = _currentAdapter;
        uint256 amountToTake = _underlyingTokenAmountForTokenAmount(adapter, maxAmount); // we consider the ratio
        uint256 amountTaken = adapter.takeBack(amountToTake, to);
        return (maxAmount * amountTaken) / amountToTake; // we still burn the same amount of PlayTokem though
    }

    function _withdrawInterest(uint256 maxAmount, address to) internal returns (uint256) {
        // Adapter adapter = _currentAdapter;
        // uint256 expectedAmount = _internal_totalSupply();
        // uint256 underlyingTokenAvailable = adapter.underlyingTokenAvailable();
        // require(underlyingTokenAvailable > expectedAmount, "NOT_ENOUGH_UNDERLYING_TOKEN");
        // uint256 toTake = underlyingTokenAvailable - expectedAmount;
        // if (toTake > maxAmount) {
        //     toTake = maxAmount;
        // }
        // return adapter.withdrawInterest(toTake, to);
        return _currentAdapter.withdrawInterest(maxAmount, to); // adapter ensure underlying token cannot be taken if it does not cover for token owner
    }

    // TODO use it to get any shares left (see yearn vault v2 for example) in case withdrawAllTo did not get all
    // TODO implement it in adapters
    function withdrawFromInactiveAdapter(Adapter adapter, address to) external onlyOwner returns (uint256) {
        require(_currentAdapter != adapter, "ADAPTER_ACTIVE");
        return adapter.withdrawWhatIsLeft(to);
    }
}
