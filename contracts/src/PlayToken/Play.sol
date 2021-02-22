// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Interfaces/ITokenManager.sol";
import "./Base.sol";
import "./WithPermitAndFixedDomain.sol";

contract Play is Base, WithPermitAndFixedDomain {
    using Address for address;

    IERC20 internal immutable _wrappedToken;
    ITokenManager internal immutable _tokenManager;

    constructor(IERC20 wrappedToken, ITokenManager tokenManager) WithPermitAndFixedDomain("1") {
        _wrappedToken = wrappedToken;
        _tokenManager = tokenManager;
        wrappedToken.approve(address(tokenManager), UINT256_MAX); // TODO embed code in this contract
    }

    string public constant symbol = "ETHERPLAY";

    function name() public pure override returns (string memory) {
        return "Etherplay";
    }

    // function mintApproveAndCall(
    //     uint256 amount,
    //     address target,
    //     bytes calldata data
    // ) external {
    //     // TODO support metatx ?
    //     // TODO support permit or transfer gateways
    //     // support ERC20 permit as appended calldata
    //     address sender = msg.sender;
    //     _wrappedToken.transferFrom(sender, address(this), amount);
    //     _mint(address(this), amount);
    //     if (_allowances[address(this)][target] < amount) {
    //         // this is the only function that will let address(this) owns some token
    //         // and it ensure it never keep it
    //         // as such we can approve it all
    //         _approveFor(address(this), target, UINT256_MAX);
    //     }
    //     target.functionCall(data);
    //     _transferAllIfAny(address(this), sender);
    //     // _approveFor(address(this), target, 0); // not necessary
    // }

    function mintAndApprovedCall(
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
        target.functionCall(data); // target can only assume the sender is the contract and will thus refund it if any
        _transferAllIfAny(address(this), sender);
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
        _mint(target, amount);
        ITransferReceiver(target).onTokenTransfer(sender, amount, data); // in this case the target will know the original sender and so refund will go to sender, no need to transfer any bacl afterward
    }

    function mint(uint256 amount) external {
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        _wrappedToken.transferFrom(sender, address(this), amount);
        _mint(sender, amount);
    }

    function burn(uint256 amount) external override {
        address sender = msg.sender;
        uint256 currentBalance = _wrappedToken.balanceOf(address(this));
        if (currentBalance < amount) {
            _tokenManager.takeBack(amount - currentBalance); // TODO embed code in this contract
        }
        _wrappedToken.transfer(sender, amount);
        _burnFrom(sender, amount);
    }
}
