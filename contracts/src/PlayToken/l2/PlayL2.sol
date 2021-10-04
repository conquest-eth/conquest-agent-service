// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

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

    // ----------------------------------------------------------------------
    // TODO remove
    // ----------------------------------------------------------------------
    mapping(address => bool) public authorized;
    bool public requireAuthorization;
    mapping(address => bool) public touched;

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(!requireAuthorization || authorized[from] || authorized[to] || !touched[to], "NOT_AUTHORIZED_TRANSFER");
        super._transfer(from, to, amount);
        touched[to] = true;
    }

    function anyNotAuthorized(address[] memory accounts) external view returns (bool) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (!authorized[accounts[i]]) {
                return true;
            }
        }
        return false;
    }

    function authorize(address[] memory accounts, bool auth) public {
        require(msg.sender == _admin(), "NOT_ADMIN");
        for (uint256 i = 0; i < accounts.length; i++) {
            authorized[accounts[i]] = auth;
        }
    }

    function enableRequireAuthorization(address[] calldata accounts) external {
        require(msg.sender == _admin(), "NOT_ADMIN");
        setRequireAuthorization(true);
        authorize(accounts, true);
    }

    function setRequireAuthorization(bool req) public {
        require(msg.sender == _admin(), "NOT_ADMIN");
        requireAuthorization = req;
    }

    function _admin() internal view returns (address adminAddress) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            adminAddress := sload(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103)
        }
    }
    // ----------------------------------------------------------------------
}
