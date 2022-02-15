// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";

contract OuterSpaceStakingFacet is OuterSpaceFacetBase {
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    // ---------------------------------------------------------------------------------------------------------------
    // STAKING / PRODUCTION CAPTURE
    // ---------------------------------------------------------------------------------------------------------------

    function onTokenTransfer(
        address,
        uint256 amount,
        bytes calldata data
    ) public returns (bool) {
        require(msg.sender == address(_stakingToken), "INVALID_ERC20");
        (address acquirer, uint256 location) = abi.decode(data, (address, uint256));
        _acquire(acquirer, amount, location); // we do not care of who the payer is
        return true;
    }

    function onTokenPaidFor(
        address,
        address forAddress,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        require(msg.sender == address(_stakingToken), "INVALID_ERC20");
        uint256 location = abi.decode(data, (uint256));
        _acquire(forAddress, amount, location); // we do not care of who the payer is
        return true;
    }

    function acquireViaTransferFrom(uint256 location, uint256 amount) public {
        address sender = _msgSender();
        _acquire(sender, amount, location);
        _stakingToken.transferFrom(sender, address(this), amount);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // EXIT / WITHDRAWALS
    // ---------------------------------------------------------------------------------------------------------------

    function exitFor(address owner, uint256 location) external {
        _exitFor(owner, location);
    }

    function fetchAndWithdrawFor(address owner, uint256[] calldata locations) external {
        _fetchAndWithdrawFor(owner, locations);
    }

    function balanceToWithdraw(address owner) external view returns (uint256) {
        return _stakeReadyToBeWithdrawn[owner];
    }

    function withdrawFor(address owner) external {
        uint256 amount = _stakeReadyToBeWithdrawn[owner];
        _withdrawAll(owner, amount);
    }
}
