// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ImportingOuterSpaceTypes {
    // front running protection : _frontruunningDelay / 2 slots
    struct InFlight {
        uint64 flying;
        uint64 destroyed;
        // STORE last attack too, to compute combined attack on it ? uint128 is plainty enough
    }

    struct Discovered {
        uint32 minX;
        uint32 maxX;
        uint32 minY;
        uint32 maxY;
    }

    struct Planet {
        address owner;
        uint32 exitTime; // could be used as startTime with first bit telling whether it is exit or startTime => means exiting would produce spacehips / or not, but not based on startTime
        uint32 numSpaceships; // uint31 + first bit => active
        uint32 lastUpdated; // also used as native-destruction indicator
    }

    struct Fleet {
        address owner;
        uint32 launchTime;
        uint32 quantity; // TODO? first bit = done? to keep quantity value on-chain post resolution
        // we got 32bit more to store if needed
    }

    struct PlanetStats {
        int8 subX;
        int8 subY;
        uint16 stake;
        uint16 production;
        uint16 attack;
        uint16 defense;
        uint16 speed;
        uint16 natives;
    }

    struct ExternalPlanet {
        address owner;
        uint32 exitTime;
        uint32 numSpaceships;
        uint32 lastUpdated;
        bool active;
        uint256 reward;
    }

    struct FleetLaunch {
        address fleetSender;
        address fleetOwner;
        uint256 from;
        uint32 quantity;
        bytes32 toHash;
    }
    struct FleetResolution {
        uint256 from;
        uint256 to;
        uint256 distance;
        bool gift;
        address specific;
        bytes32 secret;
        address fleetSender;
        address operator;
    }
}
