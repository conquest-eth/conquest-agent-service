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

    function withdrawWhatIsLeft(address to) external returns (uint256);
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

        uint256 expectedAmount = _internal_totalSupply();
        if (amount < expectedAmount) {
            require(
                _underlyingToken.transferFrom(msg.sender, address(newAdapter), expectedAmount - amount),
                "DOES_NOT_COVER_LOSS"
            );
        }
        newAdapter.use(amount, address(newAdapter));
        _currentAdapter = newAdapter;
        emit AdapterUpdated(newAdapter);
    }

    // TODO ?
    // function switchAdapterWithPotentialLoss(Adapter newAdapter) external onlyOwner {
    //     Adapter oldAdapter = _currentAdapter;
    //     uint256 amount = oldAdapter.withdrawAllTo(address(newAdapter));

    //     uint256 expectedAmount = _internal_totalSupply();
    //     if (amount < expectedAmount) {
    //         _ratio18 = (anount * 1000000000000000000) / expectedAmount;
    //         // TODO update _ratio18 on _use and
    //         // TODO use _ratio18 on _takBack,withdrawInterest,switchAdapter
    //     }
    //     newAdapter.use(amount, address(newAdapter));
    //     _currentAdapter = newAdapter;
    //     emit AdapterUpdated(newAdapter);
    // }

    function _use(uint256 amount, address from) internal {
        _currentAdapter.use(amount, from);
    }

    function _takeBack(uint256 amount, address to) internal {
        _currentAdapter.takeBack(amount, to);
    }

    function _withdrawInterest(uint256 upToUnderlyingAmount, address to) internal returns (uint256) {
        return _currentAdapter.withdrawInterest(upToUnderlyingAmount, to);
    }

    // TODO use it to get any shares left (see yearn vault v2 for example) in case withdrawAllTo did not get all
    // TODO implement it in adapters
    function withdrawFromInactiveAdapter(Adapter adapter, address to) external returns (uint256) {
        require(_currentAdapter != adapter, "ADAPTER_ACTIVE");
        return adapter.withdrawWhatIsLeft(to);
    }
}
