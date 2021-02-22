// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

abstract contract BaseInternal {
    function _approveFor(
        address owner,
        address target,
        uint256 amount
    ) internal virtual;

    function name() public virtual returns (string memory);
}
