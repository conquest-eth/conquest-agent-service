// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../Play.sol";

contract Reserve {
    using SafeERC20 for IERC20;

    Play internal immutable _playToken;
    IERC20 internal immutable _dai;
    IERC20 internal immutable _usdc;
    address internal immutable _owner;

    constructor(
        Play token,
        IERC20 dai,
        IERC20 usdc,
        address owner
    ) {
        _playToken = token;
        _owner = owner;
        _dai = dai;
        _usdc = usdc;
    }

    function payInDAI(
        uint256 amount,
        address to,
        bytes calldata data
    ) external {
        _payIn(_dai, amount, to, data);
    }

    function payInUSDC(
        uint256 amount,
        address to,
        bytes calldata data
    ) external {
        _payIn(_usdc, amount, to, data);
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

    function _payIn(
        IERC20 payToken,
        uint256 amount,
        address to,
        bytes memory data
    ) internal {
        address sender = msg.sender; // TODO _msgSender()
        // TODO use permit
        payToken.safeTransferFrom(sender, address(this), amount);
        if (data.length > 0) {
            _playToken.transferAndCall(to, amount, data); // this does not work as the payment come from Reserve
        } else {
            _playToken.transfer(to, amount);
        }
    }
}
