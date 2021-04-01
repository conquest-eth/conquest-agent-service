// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./BaseInternal.sol";
import "../Libraries/Constants.sol";
import "./WithOwner.sol";

interface Adapter {
    function use(uint256 maxAmount, address from) external returns (uint256);

    function takeBack(uint256 maxAmount, address to) external returns (uint256);

    function withdrawInterest(uint256 maxAmount, address to) external returns (uint256);

    function withdrawAllTo(address to) external returns (uint256);

    function withdrawWhatIsLeft(address to) external returns (uint256); // TODO implement in adapter
}

abstract contract DynamicAdapterWithProtectedSwitch is BaseInternal, WithOwner {
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

        uint256 expectedAmount = _internal_totalSupply();
        if (amount < expectedAmount) {
            require(
                _underlyingToken.transferFrom(msg.sender, address(newAdapter), expectedAmount - amount),
                "DOES_NOT_COVER_LOSS"
            );
        }
        newAdapter.use(expectedAmount, address(newAdapter));
        _currentAdapter = newAdapter;
        emit AdapterUpdated(newAdapter);
    }

    function _use(uint256 maxAmount, address from) internal returns (uint256) {
        return _currentAdapter.use(maxAmount, from);
    }

    function _takeBack(uint256 maxAmount, address to) internal returns (uint256) {
        return _currentAdapter.takeBack(maxAmount, to);
    }

    function _withdrawInterest(uint256 maxAmount, address to) internal returns (uint256) {
        return _currentAdapter.withdrawInterest(maxAmount, to);
    }

    // TODO use it to get any shares left (see yearn vault v2 for example) in case withdrawAllTo did not get all
    // TODO implement it in adapters
    function withdrawFromInactiveAdapter(Adapter adapter, address to) external onlyOwner returns (uint256) {
        require(_currentAdapter != adapter, "ADAPTER_ACTIVE");
        return adapter.withdrawWhatIsLeft(to);
    }
}
