// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

contract ImportingOuterSpaceConstants {
    uint256 internal constant DECIMALS_18 = 1e18;
    uint32 internal constant ACTIVE_MASK = 2**31;
    int256 internal constant UINT32_MAX = 2**32 - 1;

    int256 internal constant EXPANSION = 8;
    uint32 internal constant INITIAL_SPACE = 16;
    uint256 internal constant GIFT_TAX_PER_10000 = 2500;

    uint256 internal constant COMBAT_RULE_SWITCH_TIME = 1620144000; // Tuesday, 4 May 2021 16:00:00 GMT
}
