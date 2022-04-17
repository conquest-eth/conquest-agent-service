// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../base/erc20/UsingERC20Base.sol";
import "../base/erc20/WithPermitAndFixedDomain.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "./PlayToken.sol";

contract FreePlayToken is UsingERC20Base, WithPermitAndFixedDomain, Proxied {
    using Address for address;
    using SafeERC20 for IERC20;

    event Burner(address burner, bool enabled);
    event Minter(address burner, bool enabled);

    IERC20 internal immutable _underlyingToken;

    mapping(address => bool) public minters;
    mapping(address => bool) public burners;

    constructor(IERC20 underlyingToken) WithPermitAndFixedDomain("1") {
        _underlyingToken = underlyingToken;
    }

    string public constant symbol = "FPLAY";

    function name() public pure override returns (string memory) {
        return "Free Play";
    }

    function setBurner(address burner, bool enabled) external onlyProxyAdmin {
        burners[burner] = enabled;
        emit Burner(burner, enabled);
    }

    function setMinter(address burner, bool enabled) external onlyProxyAdmin {
        minters[burner] = enabled;
        emit Minter(burner, enabled);
    }

    function mint(
        address from,
        address to,
        uint256 amount
    ) external {
        require(minters[msg.sender], "NOT_ALLOWED_MINTER");
        _underlyingToken.safeTransferFrom(from, address(this), amount);
        _mint(to, amount);
    }

    function burn(
        address from,
        address to,
        uint256 amount
    ) external {
        require(burners[msg.sender], "NOT_ALLOWED_MINTER");
        _underlyingToken.safeTransfer(to, amount);
        _burnFrom(from, amount);
    }
}
