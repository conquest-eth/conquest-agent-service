// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "../base/ImportingOuterSpaceConstants.sol";
import "../events/ImportingOuterSpaceEvents.sol";
import "../base/UsingOuterSpaceDataLayout.sol";

contract OuterSpaceInitializationFacet is
    ImportingOuterSpaceConstants,
    ImportingOuterSpaceEvents,
    UsingOuterSpaceDataLayout
{
    bytes32 internal immutable _genesis;
    struct Config {
        bytes32 genesis;
    }

    constructor(Config memory config) {
        _genesis = config.genesis;
    }

    // TODO only owner
    function init() external {
        if (_discovered.minX == 0) {
            _discovered = Discovered({
                minX: INITIAL_SPACE,
                maxX: INITIAL_SPACE,
                minY: INITIAL_SPACE,
                maxY: INITIAL_SPACE
            });
            emit Initialized(_discovered.minX, _discovered.maxX, _discovered.minY, _discovered.maxY, _genesis);
        }
    }
}
