// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./OuterSpaceFacetBase.sol";

contract OuterSpaceInformationFacet is OuterSpaceFacetBase {
    // solhint-disable-next-line no-empty-blocks
    constructor(Config memory config) OuterSpaceFacetBase(config) {}

    function getGeneisHash() external view returns (bytes32) {
        return _genesis;
    }

    function getAllianceRegistry() external view returns (AllianceRegistry) {
        return _allianceRegistry;
    }


    function getDiscovered() external view returns (Discovered memory) {
        return _discovered;
    }
}
