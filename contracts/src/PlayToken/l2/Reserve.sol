// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Play.sol";
import "ethereum-transfer-gateway/src/solc_0.8/BaseERC20TransferRecipient.sol";

contract Reserve is BaseERC20TransferRecipient {
    using SafeERC20 for IERC20;

    Play internal immutable _playToken;
    IERC20 internal immutable _dai;
    IERC20 internal immutable _usdc;
    address internal immutable _owner;

    constructor(
        Play token,
        IERC20 dai,
        IERC20 usdc,
        address owner,
        address gateway
    ) BaseERC20TransferRecipient(gateway) {
        _playToken = token;
        _owner = owner;
        _dai = dai;
        _usdc = usdc;
        // TODO pre_approve
    }

    function approved_payInDAI(
        uint256 amount,
        address to,
        bytes calldata data
    ) external {
        _payInViaTransferFrom(msg.sender, _dai, amount, to, data); // TODO decimal compatibility
    }

    function approved_payInUSDC(
        uint256 amount,
        address to,
        bytes calldata data
    ) external {
        _payInViaTransferFrom(msg.sender, _usdc, amount, to, data); // TODO decimal compatibility
    }

    function payViaGateway(address to, bytes calldata data) external {
        (address token, uint256 amount, address sender) = _getTokenTransfer(); // TODO import transfer-gateway repo
        require(IERC20(token) == _dai || IERC20(token) == _usdc, "INVALID_PAYMENT_TOKEN");
        // TODO decimal compatibility
        _payIn(sender, amount, to, data);
    }

    function withdraw(
        IERC20 token,
        uint256 amount,
        address to
    ) external {
        require(msg.sender == _owner, "NOT_AUTHORIZED");
        token.safeTransfer(to, amount);
    }

    // ----------------------------------------------------------
    //                        INTERNALS
    // ----------------------------------------------------------

    function _payInViaTransferFrom(
        address payer,
        IERC20 payToken,
        uint256 amount,
        address to,
        bytes memory data
    ) internal {
        payToken.safeTransferFrom(payer, address(this), amount);
        _payIn(payer, amount, to, data);
    }

    function _payIn(
        address payer,
        uint256 amount,
        address to,
        bytes memory data
    ) internal {
        if (data.length > 0) {
            _playToken.payForAndCall(payer, to, amount, data);
        } else {
            _playToken.transfer(to, amount);
        }
    }
}
