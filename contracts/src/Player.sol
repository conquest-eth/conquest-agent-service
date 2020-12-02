// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contract PlayerVault {
//     address _controller;
//     IERC20 immutable _payToken;
//     constructor(IERC20 payToken) {
//         _payToken = payToken;
//     }

//     function setController(address controller) external {
//         require(_controller == address(0), "already set");
//         _controller = controller;
//         _payToken.approve(controller, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
//     }
// }

interface PaymentDestination {
    function depositFor(address target) external payable;

    function tokensDeposited(
        address farget,
        address from,
        IERC20 token,
        uint256 amount
    ) external;
}

contract PaymentGateway {
    PaymentDestination _destination;

    function setDestination(PaymentDestination destination) external {
        require(address(_destination) == address(0), "already set");
        _destination = destination;
    }

    function depositFor(address target) external payable {
        _destination.depositFor{value: msg.value}(target);
    }

    function tokensDeposited(
        address target,
        IERC20 token,
        uint256 amount
    ) external {
        token.transfer(address(_destination), amount);
        _destination.tokensDeposited(target, msg.sender, token, amount);
    }
}

contract Player is PaymentDestination {
    event Call(bool success, bytes returnData);

    event Withdrawn(
        address indexed account,
        address indexed dest,
        address token, // address(0) for ETH
        uint256 amount
    );

    event Deposited(
        address indexed paymaster,
        address indexed from,
        address token, // address(0) for ETH
        uint256 amount
    );

    IERC20 immutable _payToken;
    PaymentGateway _paymentGateway;
    mapping(address => mapping(IERC20 => uint256)) _tokenBalances;
    mapping(address => uint256) _ethBalances;
    mapping(address => address) _delegates;

    constructor(IERC20 payToken, PaymentGateway paymentGateway) {
        _payToken = payToken;
        _paymentGateway = paymentGateway;
        paymentGateway.setDestination(this);
    }

    function depositFor(address target) external payable override {
        _ethBalances[target] += msg.value;
        emit Deposited(target, msg.sender, address(0), msg.value);
    }

    function tokensDeposited(
        address target,
        address from,
        IERC20 token,
        uint256 amount
    ) external override {
        require(msg.sender == address(_paymentGateway), "can only receive tokens from payment gateway");
        _tokenBalances[target][token] += amount;
        emit Deposited(target, from, address(token), amount);
    }

    function withdraw(uint256 amount, address payable dest) external {
        address payable account = _msgSender();
        require(_ethBalances[account] >= amount, "insufficient funds");
        _ethBalances[account] -= amount;
        dest.transfer(amount);
        emit Withdrawn(account, dest, address(0), amount);
    }

    function withdrawToken(
        IERC20 token,
        uint256 amount,
        address payable dest
    ) external {
        address payable account = _msgSender();
        require(_tokenBalances[account][token] >= amount, "insufficient funds");
        _tokenBalances[account][token] -= amount;
        token.transfer(dest, amount);
        emit Withdrawn(account, dest, address(token), amount);
    }

    function forward(
        address destination,
        uint256 gasLimit,
        bytes calldata data
    ) external returns (bool success, bytes memory returnData) {
        // ///////////////////////// GAS METERING //////////////////////////////////////////////////////////////////////////////////////////
        uint256 initialGas = gasleft();

        require(destination != address(this), "cannot call itself");

        address sender = _msgSender(); // signer of message
        address playerAddressViaDelegate = _delegates[sender]; // is the signer a delegate ? if so forward the playerAddress instead
        if (playerAddressViaDelegate != address(0)) {
            sender = playerAddressViaDelegate;
        }

        (success, returnData) = _executeWithSpecificGas(destination, gasLimit, abi.encode(data, sender));

        emit Call(success, returnData);

        // ///////////////////////// GAS METERING //////////////////////////////////////////////////////////////////////////////////////////
        uint256 ethCharge = ((initialGas - gasleft()) + 10000) * tx.gasprice;
        if (ethCharge <= _ethBalances[sender]) {
            // address(this).transfer(ethCharge); // TODO
        } else {
            // TODO ETH charge
            // or get price of ETH in DAI and charge DAI
            revert("payment other than ETH not supported");
        }
    }

    function _msgSender() internal pure returns (address payable signer) {
        bytes memory data = msg.data;
        uint256 length = msg.data.length;
        assembly {
            signer := mload(sub(add(data, length), 0x00))
        } // forwarder would have added that
    }

    function _executeWithSpecificGas(
        address to,
        uint256 gasLimit,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        (success, returnData) = to.call{gas: gasLimit}(data);
        assert(gasleft() > gasLimit / 63);
    }
}
