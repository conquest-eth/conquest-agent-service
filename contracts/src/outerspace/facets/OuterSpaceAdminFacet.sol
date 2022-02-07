// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";
import "hardhat-deploy/solc_0.8/diamond/UsingDiamondOwner.sol";

contract OuterSpaceAdminFacet is UsingDiamondOwner, OuterSpaceFacetBase {
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    // TODO : ERC20, ERC721, ERC1155
    // remove sponsor, use msg.sender and this could be special contracts
    // TODO : reenable, removed because of code size issue
    function addReward(uint256 location, address sponsor) external onlyOwner {
        Planet memory planet = _planets[location];
        if (_hasJustExited(planet.exitTime)) {
            _setPlanetAfterExit(location, planet.owner, _planets[location], address(0), 0);
        }

        uint256 rewardId = _rewards[location];
        if (rewardId == 0) {
            rewardId = ++_prevRewardIds[sponsor];
            _rewards[location] = (uint256(uint160(sponsor)) << 96) + rewardId;
        }
        // TODO should it fails if different sponsor added reward before

        // TODO rewardId association with the actual rewards // probably contract address holding the reward
        emit RewardSetup(location, sponsor, rewardId);
    }

    function resetPlanet(uint256 location) external onlyOwner {
        _planets[location].owner = address(0);
        _planets[location].exitTime = 0;
        _planets[location].numSpaceships = 0;
        _planets[location].lastUpdated = 0;
        emit PlanetReset(location);
    }
}
