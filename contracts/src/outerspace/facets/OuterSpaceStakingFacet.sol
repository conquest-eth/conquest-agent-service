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
        Planet storage planet = _getPlanet(location);
        require(owner == planet.owner, "NOT_OWNER");
        require(planet.exitStartTime == 0, "EXITING_ALREADY"); // if you own the planet again, you ll need to first withdraw
        planet.exitStartTime = uint32(block.timestamp);
        emit PlanetExit(owner, location);
    }

    function fetchAndWithdrawFor(address owner, uint256[] calldata locations) external {
        uint256 addedStake = 0;
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            if (_hasJustExited(planet.exitStartTime)) {
                require(owner == planet.owner, "NOT_OWNER");
                addedStake += _setPlanetAfterExitWithoutUpdatingStake(locations[i], owner, planet, address(0), 0); // no need of event as exitTime passed basically mean owner zero and spaceships zero
            }
        }
        uint256 newStake = _stakeReadyToBeWithdrawn[owner] + addedStake;
        _withdrawAll(owner, newStake);
    }

    function balanceToWithdraw(address owner) external view returns (uint256) {
        return _stakeReadyToBeWithdrawn[owner];
    }

    function withdrawFor(address owner) external {
        uint256 amount = _stakeReadyToBeWithdrawn[owner];
        _withdrawAll(owner, amount);
    }

    function _withdrawAll(address owner, uint256 amount) internal {
        _updateStake(owner, 0);
        require(_stakingToken.transfer(owner, amount), "FAILED_TRANSFER"); // TODO FundManager
    }
}
