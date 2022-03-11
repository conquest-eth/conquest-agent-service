// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";
import "../interfaces/IOuterSpacePlanets.sol";
import "../interfaces/IApprovalReceiver.sol";

contract OuterSpacePlanetsFacet is OuterSpaceFacetBase, IOuterSpacePlanets {
    // solhint-disable-next-line no-empty-blocks
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    function setApprovalForAllIfNeededAndCall(IApprovalReceiver operator, bytes calldata data) external {
        address sender = _msgSender();
        if (!_operators[sender][address(operator)]) {
            _operators[sender][address(operator)] = true;
            emit ApprovalForAll(sender, address(operator), true);
        }
        operator.onApprovalForAllBy(sender, data);
    }

    function ownerOf(uint256 location) external view returns (address currentOwner) {
        Planet storage planet = _getPlanet(location);
        currentOwner = planet.owner;
        // TODO should we ?
        // if (_hasJustExited(_planets[location].exitStartTime)) {
        //     currentOwner = address(0);
        // } else {
        //     PlanetUpdateState memory planetUpdate = _createPlanetUpdateState(planet, location);
        //     _computePlanetUpdateForTimeElapsed(planetUpdate);
        //     if (!planetUpdate.active && planetUpdate.numSpaceships == 0) {
        //         currentOwner = address(0);
        //     }
        // }
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operators[owner][operator];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 location
    ) external {
        // TODO safe callback
        _transfer(from, to, location);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 location,
        bytes calldata data
    ) external {
        // TODO safe callback + data
        _transfer(from, to, location);
    }

    function transferFrom(
        address from,
        address to,
        uint256 location
    ) external {
        _transfer(from, to, location);
    }

    function _transfer(
        address from,
        address to,
        uint256 location
    ) internal {
        require(from != address(0), "NOT_ZERO_ADDRESS");
        require(to != address(0), "NOT_ZERO_ADDRESS");

        // -----------------------------------------------------------------------------------------------------------
        // Initialise State Update
        // -----------------------------------------------------------------------------------------------------------
        Planet storage planet = _getPlanet(location);
        PlanetUpdateState memory planetUpdate = _createPlanetUpdateState(planet, location);

        // -----------------------------------------------------------------------------------------------------------
        // Compute Basic Planet Updates
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForTimeElapsed(planetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // check requirements
        // -----------------------------------------------------------------------------------------------------------

        require(planetUpdate.newOwner == from, "FROM_NOT_OWNER");
        if (msg.sender != planetUpdate.newOwner) {
            require(_operators[planetUpdate.newOwner][msg.sender], "NOT_OPERATOR");
        }

        // -----------------------------------------------------------------------------------------------------------
        // Perform Transfer
        // -----------------------------------------------------------------------------------------------------------
        planetUpdate.newOwner = to;
        // NOTE transfer incurs a tax if the new owner and previous owner are not in an alliance since at least 3 days.
        if (planetUpdate.numSpaceships > 0 && !_isFleetOwnerTaxed(from, to, uint40(block.timestamp - 3 days))) {
            planetUpdate.numSpaceships = uint32(
                uint256(planetUpdate.numSpaceships) - (uint256(planetUpdate.numSpaceships) * _giftTaxPer10000) / 10000
            );
        }

        // -----------------------------------------------------------------------------------------------------------
        // Write New State
        // -----------------------------------------------------------------------------------------------------------
        _setPlanet(planet, planetUpdate, false);

        // -----------------------------------------------------------------------------------------------------------
        // Emit Event
        // -----------------------------------------------------------------------------------------------------------
        emit PlanetTransfer(
            from,
            to,
            location,
            planetUpdate.numSpaceships,
            planetUpdate.travelingUpkeep,
            planetUpdate.overflow
        );
    }

    function ownerAndOwnershipStartTimeOf(uint256 location)
        external
        view
        returns (address owner, uint40 ownershipStartTime)
    {
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
