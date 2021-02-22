// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Base.sol";
import "../WithPermitAndFixedDomain.sol";

contract PlayMaticChildToken is Base, WithPermitAndFixedDomain {
    constructor() WithPermitAndFixedDomain("1") {}

    string public constant symbol = "M ETHERPLAY";

    function name() public pure override returns (string memory) {
        return "Matic Etherplay";
    }

    // TODO Matic specific
}
