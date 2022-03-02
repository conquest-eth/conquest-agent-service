// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";
import "hardhat-deploy/solc_0.8/diamond/UsingDiamondOwner.sol";

contract OuterSpaceAdminFacet is UsingDiamondOwner, OuterSpaceFacetBase {
    // solhint-disable-next-line no-empty-blocks
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    // TODO : ERC20, ERC721, ERC1155
    // remove sponsor, use msg.sender and this could be special contracts
    // TODO : reenable, removed because of code size issue
    function addReward(uint256 location, address sponsor) external onlyOwner {
        _addReward(location, sponsor);
    }

    function resetPlanet(uint256 location) external onlyOwner {
        // TODO
        // if (_planets[location].owner == address(0) && active) {
        //     //update totalProduction
        // }

        _planets[location].owner = address(0);
        _planets[location].ownershipStartTime = 0;
        _planets[location].exitStartTime = 0;

        _planets[location].numSpaceships = 0;
        _planets[location].lastUpdated = 0;
        _planets[location].overflow = 0;

        emit PlanetReset(location);
    }
}
