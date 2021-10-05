// SPDX-License-Identifier: AGPL-1.0
pragma solidity 0.8.9;

import "../OuterSpace.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Agent {
    using ECDSA for bytes32;

    address internal immutable _signer;
    OuterSpace internal immutable _outerspace;
    constructor(address signer, OuterSpace outerspace) {
        _signer = signer;
        _outerspace = outerspace;
    }

    // TODO include gasPrice in signed message

    // function resolveFleet(uint256 fleetID, uint256 from, uint256 to, uint256 distance, bytes32 secret, bytes calldata signature) external {
    //     uint256 startgas = gasleft();
    //     bytes32 digest = keccak256(
    //         abi.encodePacked(msg.sender, fleetID, from, to, distance, secret, false)
    //     ).toEthSignedMessageHash();
    //     address signer = digest.recover(signature);
    //     require(signer == _signer);
    //     _outerspace.resolveFleet(fleetID, from, to, distance, secret);
    //     payable(msg.sender).transfer(tx.gasprice * ((gasleft() - startgas) + 30000));
    // }

    // function resolveFleetWithSignerAssumingFailureCost(uint256 fleetID, uint256 from, uint256 to, uint256 distance, bytes32 secret, bytes calldata signature) external {
    //     uint256 startgas = gasleft();
    //     bytes32 digest = keccak256(
    //         abi.encodePacked(msg.sender, fleetID, from, to, distance, secret, true)
    //     ).toEthSignedMessageHash();
    //     address signer = digest.recover(signature);
    //     require(signer == _signer);
    //     // TODO // try {
    //         _outerspace.resolveFleet(fleetID, from, to, distance, secret);
    //     // } catch {

    //     // }
    //     payable(msg.sender).transfer(tx.gasprice * ((gasleft() - startgas) + 30000));
    // }

}
