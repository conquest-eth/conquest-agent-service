// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "../types/ImportingOuterSpaceTypes.sol";
import "../events/ImportingOuterSpaceEvents.sol";

interface IOuterSpacePlanets is ImportingOuterSpaceTypes, ImportingOuterSpaceEvents {
    function setApprovalForAll(address operator, bool approved) external;

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats);

    function getPlanetStates(uint256[] calldata locations)
        external
        view
        returns (ExternalPlanet[] memory planetStates, Discovered memory discovered);
}
