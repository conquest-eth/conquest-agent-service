// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Interfaces/ITokenManager.sol";

contract TokenManager is ITokenManager {
    IERC20 internal immutable _token;
    address internal immutable _tokenOwner;
    address internal immutable _owner;

    constructor(
        IERC20 token,
        address tokenOwner,
        address owner
    ) {
        _token = token;
        _tokenOwner = tokenOwner;
        _owner = owner;
    }

    function takeBack(uint256 amount) external override {
        require(msg.sender == _tokenOwner, "NOT_AUTHORIZED");
        // TODO
        _token.transfer(_tokenOwner, amount);
    }

    function use(uint256 amount) public {
        require(msg.sender == _owner, "NOT_AUTHORIZED");
        // TODO
        _token.transferFrom(_tokenOwner, address(this), amount);
    }

    // TODO changeOwner : EIP-173 ?
}
