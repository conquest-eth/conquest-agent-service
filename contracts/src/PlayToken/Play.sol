// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Interfaces/ITokenManager.sol";
import "./PlayInternal.sol";
import "./PlayPermit.sol";

interface ITransferReceiver {
    function onTokenTransfer(
        address,
        uint256,
        bytes calldata
    ) external returns (bool);
}

interface IApprovalReceiver {
    function onTokenApproval(
        address,
        uint256,
        bytes calldata
    ) external returns (bool);
}

contract Play is IERC20, PlayInternal, PlayPermit {
    using Address for address;

    uint256 internal constant UINT256_MAX = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    string public constant name = "Play";
    string public constant symbol = "PLAY";

    IERC20 internal immutable _wrappedToken;
    ITokenManager internal immutable _tokenManager;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    constructor(IERC20 wrappedToken, ITokenManager tokenManager) {
        _wrappedToken = wrappedToken;
        _tokenManager = tokenManager;
        wrappedToken.approve(address(tokenManager), UINT256_MAX); // TODO embed code in this contract
    }

    function mintAndCall(
        uint256 amount,
        address target,
        bytes calldata data
    ) external {
        // TODO support metatx ?
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        _wrappedToken.transferFrom(sender, address(this), amount);
        _mint(address(this), amount);
        target.functionCall(data);
        _transferAllIfAny(address(this), sender);
    }

    function mint(uint256 amount) external {
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        _wrappedToken.transferFrom(sender, address(this), amount);
        _mint(sender, amount);
    }

    function burn(uint256 amount) external {
        address sender = msg.sender;
        uint256 currentBalance = _wrappedToken.balanceOf(address(this));
        if (currentBalance < amount) {
            _tokenManager.takeBack(amount - currentBalance); // TODO embed code in this contract
        }
        _wrappedToken.transfer(sender, amount);
        _burnFrom(sender, amount);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) external view override returns (uint256) {
        return _balances[owner];
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function decimals() external pure virtual returns (uint8) {
        return uint8(18);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        // TODO support metatx ?
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferAndCall(
        address to,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return ITransferReceiver(to).onTokenTransfer(msg.sender, amount, data);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        if (msg.sender != from) {
            uint256 currentAllowance = _allowances[from][msg.sender];
            if (currentAllowance != UINT256_MAX) {
                // save gas when allowance is maximal by not reducing it (see https://github.com/ethereum/EIPs/issues/717)
                require(currentAllowance >= amount, "NOT_AUTHOIZED_ALLOWANCE");
                _allowances[from][msg.sender] = currentAllowance - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        // TODO support metatx ?
        _approveFor(msg.sender, spender, amount);
        return true;
    }

    function approveAndCall(
        address spender,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        _approveFor(msg.sender, spender, amount);
        return IApprovalReceiver(spender).onTokenApproval(msg.sender, amount, data);
    }

    function _approveFor(
        address owner,
        address spender,
        uint256 amount
    ) internal override {
        require(owner != address(0) && spender != address(0), "INVALID_ZERO_ADDRESS");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(to != address(0), "INVALID_ZERO_ADDRESS");
        require(to != address(this), "INVALID_THIS_ADDRESS");
        uint256 currentBalance = _balances[from];
        require(currentBalance >= amount, "NOT_ENOUGH_TOKENS");
        _balances[from] = currentBalance - amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _transferAllIfAny(address from, address to) internal {
        uint256 balanceLeft = _balances[from];
        if (balanceLeft > 0) {
            _balances[from] = 0;
            _balances[to] += balanceLeft;
            emit Transfer(from, to, balanceLeft);
        }
    }

    function _mint(address to, uint256 amount) internal {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burnFrom(address from, uint256 amount) internal {
        uint256 currentBalance = _balances[from];
        require(currentBalance >= amount, "NOT_ENOUGH_TOKENS");
        _balances[from] = currentBalance - amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
