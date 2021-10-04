// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../Interfaces/ITokenManager.sol";
import "./Base.sol";
import "./WithPermitAndFixedDomain.sol";
import "./CompoundAdapter.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

contract Play is Base, WithPermitAndFixedDomain, CompoundAdapter, Proxied {
    using Address for address;

    address internal _owner; // TODO ownership as extension

    constructor(
        IERC20 underlyingToken,
        ICompoundERC20 cToken,
        address owner
    ) WithPermitAndFixedDomain("1") CompoundAdapter(underlyingToken, cToken) {
        postUpgrade(underlyingToken, cToken, owner);
    }

    function postUpgrade(
        IERC20,
        ICompoundERC20,
        address owner
    ) public {
        // 2 first arguments used as immutable in CompoundAdapter
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
        uint256 maxAmount,
        address target,
        bytes calldata data
    ) external {
        // TODO support metatx ?
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        uint256 actualAmount = _use(maxAmount, sender);
        _mint(sender, actualAmount);
        target.functionCall(data); // target can only assume the sender is the contract and will thus refund it if any
        _transferAllIfAny(address(this), sender);
    }

    function mintAndCall(
        uint256 maxAmount,
        address target,
        bool requireFullAmount,
        bytes calldata data
    ) external returns (uint256) {
        // TODO support metatx ?
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        uint256 actualAmount = _use(maxAmount, sender);
        if (requireFullAmount) {
            require(actualAmount == maxAmount, "COULD_NOT_MINT_REQUESTED_AMOUNT");
        }
        _mint(sender, actualAmount);
        ITransferReceiver(target).onTokenTransfer(sender, actualAmount, data);
        // in this case the target will know the original sender and so refund will go to sender, no need to transfer any bacl afterward
        // but in case :
        _transferAllIfAny(address(this), sender);
        return actualAmount;
    }

    function mint(uint256 maxAmount) external returns (uint256) {
        // TODO support permit or transfer gateways
        // support ERC20 permit as appended calldata
        address sender = msg.sender;
        uint256 actualAmount = _use(maxAmount, sender);
        _mint(sender, actualAmount);
        return actualAmount;
    }

    function burn(uint256 maxAmount) external returns (uint256) {
        address sender = msg.sender;
        uint256 amountBurnt = _takeBack(maxAmount, sender);
        _burnFrom(sender, amountBurnt);
        return amountBurnt;
    }

    function burnTo(uint256 maxAmount, address to) external returns (uint256) {
        address sender = msg.sender;
        uint256 amountBurnt = _takeBack(maxAmount, to);
        _burnFrom(sender, amountBurnt);
        return amountBurnt;
    }

    function burnToAndCall(
        uint256 maxAmount,
        address target,
        bool requireFullAmount,
        bytes calldata data
    ) external returns (uint256) {
        address sender = msg.sender;
        uint256 amountBurnt = _takeBack(maxAmount, target);
        if (requireFullAmount) {
            require(amountBurnt == maxAmount, "COULD_NOT_BURN_REQUESTED_AMOUNT");
        }
        _burnFrom(sender, amountBurnt);
        IBurnReceiver(target).onTokenBurn(sender, amountBurnt, data);
        return amountBurnt;
    }

    function withdraw(uint256 maxAmount, address to) external returns (uint256) {
        require(msg.sender == _owner, "NOT_AUTHORIZED");
        return _withdrawInterest(maxAmount, to);
    }

    // can be used to render user full in case of lack of underlying token
    // this does not create token in return
    function depositWithoutReturn(uint256 maxAmount) external returns (uint256) {
        address sender = msg.sender;
        return _use(maxAmount, sender);
    }
}
