// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../Interfaces/ITokenManager.sol";
import "../Base.sol";
import "../WithPermitAndFixedDomain.sol";

contract PlayL2 is Base, WithPermitAndFixedDomain {
    using Address for address;

    address internal _l2Messenger; // TODO proper birdging

    constructor(address l2Messenger) WithPermitAndFixedDomain("1") {
        postUpgrade(l2Messenger);
    }

    function postUpgrade(address l2Messenger) public {
        _l2Messenger = l2Messenger;
    }

    string public constant symbol = "ETHERPLAY"; // TODO rename for l2?

    function name() public pure override returns (string memory) {
        return "Etherplay"; // TODO rename for l2?
    }

    function fromL1(address to, uint256 amount) external {
        require(msg.sender == _l2Messenger);
        _mint(to, amount);
    }

    // function mint(uint256 amount) external {
    //     // TODO remove
    //     address sender = msg.sender;
    //     _mint(sender, amount);
    // }
}
