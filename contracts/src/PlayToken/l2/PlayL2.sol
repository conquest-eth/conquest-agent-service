// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../Interfaces/ITokenManager.sol";
import "../Base.sol";
import "../WithPermitAndFixedDomain.sol";

contract PlayL2 is Base, WithPermitAndFixedDomain {
    using Address for address;

    constructor() WithPermitAndFixedDomain("1") {}

    string public constant symbol = "ETHERPLAY"; // TODO rename for l2?

    function name() public pure override returns (string memory) {
        return "Etherplay"; // TODO rename for l2?
    }

    function mint(uint256 amount) external {
        // TODO remove
        address sender = msg.sender;
        _mint(sender, amount);
    }
}
