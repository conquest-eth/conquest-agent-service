// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Interfaces/ITokenManager.sol";
import "./Base.sol";
import "./WithPermitAndFixedDomain.sol";
import "./CompoundAdapter.sol";

contract Play is Base, WithPermitAndFixedDomain, CompoundAdapter {
    using Address for address;

    address internal _owner; // TODO ownership as extension

    constructor(
        IERC20 underlyingToken,
        ICompoundERC20 cToken,
        address owner
    ) WithPermitAndFixedDomain("1") CompoundAdapter(underlyingToken, cToken) {
        _owner = owner;
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
        _use(amount, sender);
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
        _use(amount, sender);
        _mint(target, amount);
        ITransferReceiver(target).onTokenTransfer(sender, amount, data);
        // in this case the target will know the original sender and so refund will go to sender, no need to transfer any bacl afterward
        // but in case :
        _transferAllIfAny(address(this), sender);
    }

    function mint(uint256 amount) external {
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        _use(amount, sender);
        _mint(sender, amount);
    }

    function burn(uint256 amount) external override {
        address sender = msg.sender;
        _burnFrom(sender, amount);
        _takeBack(amount, sender);
    }

    function withdraw(uint256 upToAmount, address to) external returns (uint256) {
        require(msg.sender == _owner, "NOT_AUTHORIZED");
        return _withdrawInterest(upToAmount, to);
    }
}
