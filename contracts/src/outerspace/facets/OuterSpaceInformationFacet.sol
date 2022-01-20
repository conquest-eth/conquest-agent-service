// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";

contract OuterSpaceInformationFacet is OuterSpaceFacetBase {

    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    function getGeneisHash() external view returns (bytes32) {
        return _genesis;
    }

    function getAllianceRegistry() external view returns (AllianceRegistry) {
        return _allianceRegistry;
    }

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats) {
        Planet storage planet = _getPlanet(location);
        (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        state = ExternalPlanet({
            owner: planet.owner,
            exitTime: planet.exitTime,
            numSpaceships: numSpaceships,
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
                exitTime: planet.exitTime,
                numSpaceships: numSpaceships,
                lastUpdated: planet.lastUpdated,
                active: active,
                reward: _rewards[locations[i]]
            });
        }
        discovered = _discovered;
    }

    function getDiscovered() external view returns (Discovered memory) {
        return _discovered;
    }

}
