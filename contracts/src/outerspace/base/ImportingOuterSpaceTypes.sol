// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ImportingOuterSpaceTypes {

    // front running protection : _frontruunningDelay / 2 slots
    struct InFlight {
        uint64 flying;
        uint64 destroyed;
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
        uint32 quantity;
        // TODO uint32 delay
    }
}
