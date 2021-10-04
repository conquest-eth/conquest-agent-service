// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "../Interfaces/IERC165.sol";

contract WithOwner is IERC165 {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    address public owner;

    constructor(address _owner) {
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_AUTHORIZED");
        _;
    }

    function supportsInterface(bytes4 interfaceID) external pure virtual override returns (bool) {
        return interfaceID == 0x7f5828d0 || interfaceID == 0x01ffc9a7;
    }
}
