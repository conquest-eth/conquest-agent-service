// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";
import "../interfaces/IOuterSpacePlanets.sol";

contract OuterSpacePlanetsFacet is OuterSpaceFacetBase, IOuterSpacePlanets {
    // solhint-disable-next-line no-empty-blocks
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    // ---------------------------------------------------------------------------------------------------------------
    // ERC721 : // TODO
    // ---------------------------------------------------------------------------------------------------------------
    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats) {
        Planet storage planet = _getPlanet(location);
        (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        state = ExternalPlanet({
            owner: planet.owner,
            ownershipStartTime: planet.ownershipStartTime,
            exitStartTime: planet.exitStartTime,
            numSpaceships: numSpaceships,
            overflow: planet.overflow,
            lastUpdated: planet.lastUpdated,
            active: active,
            reward: _rewards[location]
        });
        stats = _getPlanetStats(location);
    }

    function getPlanetStates(uint256[] calldata locations)
        external
        view
        returns (ExternalPlanet[] memory planetStates, Discovered memory discovered)
    {
        planetStates = new ExternalPlanet[](locations.length);
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
            planetStates[i] = ExternalPlanet({
                owner: planet.owner,
                ownershipStartTime: planet.ownershipStartTime,
                exitStartTime: planet.exitStartTime,
                numSpaceships: numSpaceships,
                overflow: planet.overflow,
                lastUpdated: planet.lastUpdated,
                active: active,
                reward: _rewards[locations[i]]
            });
        }
        discovered = _discovered;
    }
}
