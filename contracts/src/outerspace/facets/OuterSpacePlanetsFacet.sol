// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";
import "../interfaces/IOuterSpacePlanets.sol";

contract OuterSpacePlanetsFacet is OuterSpaceFacetBase, IOuterSpacePlanets {
    // solhint-disable-next-line no-empty-blocks
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    function ownerOf(uint256 location) external view returns (address currentOwner) {
        currentOwner = _planets[location].owner;
        // TODO should we ?
        // if (_hasJustExited(_planets[location].exitStartTime)) {
        //     currentOwner = address(0);
        // }
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operators[owner][operator];
    }

    function safeTransferFrom(address from, address to, uint256 location) external {
        // TODO safe callback
        _transfer(from, to, location);
    }
    function safeTransferFrom(address from, address to, uint256 location, bytes calldata data) external {
        // TODO safe callback + data
        _transfer(from, to, location);
    }
    function transferFrom(address from, address to, uint256 location) external {
        _transfer(from, to, location);
    }

    function _transfer(address from, address to, uint256 location) internal {
        require(from != address(0), "NOT_ZERO_ADDRESS");

        // TODO extract, see ownerOf (same code)
        address currentOwner = _planets[location].owner;
        if (_hasJustExited(_planets[location].exitStartTime)) {
            currentOwner = address(0);
        }

        require(currentOwner == from, "FROM_NOT_OWNER");
        if (msg.sender != currentOwner) {
            require(_operators[currentOwner][msg.sender], "NOT_OPERATOR");
        }

        _planets[location].owner = to;
        _planets[location].ownershipStartTime = uint40(block.timestamp);

        emit Transfer(from, to, location);
    }

    function ownerAndOwnershipStartTimeOf(uint256 location) external view returns (address owner, uint40 ownershipStartTime) {
        owner = _planets[location].owner;
        ownershipStartTime = _planets[location].ownershipStartTime;
    }

    function getPlanetState(uint256 location) external view returns (Planet memory state) {
        return _planets[location];
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
}
