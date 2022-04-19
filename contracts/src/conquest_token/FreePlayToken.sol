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
    using SafeERC20 for PlayToken;

    uint256 internal constant DECIMALS_18 = 1000000000000000000;

    event Burner(address burner, bool enabled);
    event Minter(address burner, bool enabled);

    PlayToken internal immutable _underlyingToken;

    mapping(address => bool) public minters;
    mapping(address => bool) public burners;

    constructor(PlayToken underlyingToken) WithPermitAndFixedDomain("1") {
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

    // function onTokenTransfer(
    //     address from,
    //     uint256 amount,
    //     bytes calldata data
    // ) public returns (bool) {
    //     require(msg.sender == address(_underlyingToken), "INVALID_ERC20");
    //     require(minters[from], "NOT_ALLOWED_MINTER");

    //     address to = abi.decode(data, (address));
    //     _mint(to, amount);
    //     return true;
    // }

    // function onTokenPaidFor(
    //     address from,
    //     address forAddress,
    //     uint256 amount,
    //     bytes calldata data
    // ) external returns (bool) {
    //     require(msg.sender == address(_underlyingToken), "INVALID_ERC20");
    //     require(minters[from], "NOT_ALLOWED_MINTER");
    //     _mint(forAddress, amount);
    //     return true;
    // }

    function mintViaNativeToken(address to, uint256 amount) external payable {
        require(minters[msg.sender], "NOT_ALLOWED_MINTER");
        _underlyingToken.mint{value: msg.value}(address(this), amount);
        _mint(to, amount);
    }

    function mintViaNativeTokenPlusSendExtraNativeTokens(address payable to, uint256 amount) external payable {
        require(minters[msg.sender], "NOT_ALLOWED_MINTER");
        uint256 valueExpected = (amount * DECIMALS_18) / _underlyingToken.numTokensPerNativeTokenAt18Decimals();
        _underlyingToken.mint{value: valueExpected}(address(this), amount);
        _mint(to, amount);
        if (msg.value > valueExpected) {
            to.transfer(msg.value - valueExpected);
        }
    }

    function mintMultipleViaNativeTokenPlusSendExtraNativeTokens(
        address payable[] calldata tos,
        uint256[] calldata amounts,
        uint256[] calldata nativeTokenAmounts
    ) external payable {
        require(minters[msg.sender], "NOT_ALLOWED_MINTER");
        for (uint256 i = 0; i < tos.length; i++) {
            uint256 valueExpected = (amounts[i] * DECIMALS_18) / _underlyingToken.numTokensPerNativeTokenAt18Decimals();
            _underlyingToken.mint{value: valueExpected}(address(this), amounts[i]);
            _mint(tos[i], amounts[i]);
            if (nativeTokenAmounts[i] > 0) {
                tos[i].transfer(nativeTokenAmounts[i]);
            }
        }
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
        require(burners[msg.sender], "NOT_ALLOWED_BURNER");
        _underlyingToken.safeTransfer(to, amount);
        _burnFrom(from, amount);
    }
}
