// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./AllianceRegistry.sol";
// import "../interfaces/IAlliance.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract BasicAlliance {
    bool internal _original;
    AllianceRegistry internal immutable _allianceRegistry;
    address public admin;

    // constructor(AllianceRegistry allianceRegistry, AllianceRegistry.PlayerSubmission[] memory playerSubmissions) {
    //     _allianceRegistry = allianceRegistry;
    //     _allianceRegistry.addMultiplePlayersToAlliance(playerSubmissions);
    // }

    constructor(AllianceRegistry allianceRegistry) {
        _allianceRegistry = allianceRegistry;
        _original = true;
        admin = address(1); // lock it
    }

    function setAdminAndAddMembers(address newAdmin, AllianceRegistry.PlayerSubmission[] calldata playerSubmissions)
        public
    {
        address currentAdmin = admin;
        require(currentAdmin == address(0) || msg.sender == currentAdmin, "NOT_ALLOWED");
        admin = newAdmin;
        if (playerSubmissions.length > 0) {
            _allianceRegistry.addMultiplePlayersToAlliance(playerSubmissions);
        }
    }

    function addMembers(AllianceRegistry.PlayerSubmission[] calldata playerSubmissions) external {
        require(msg.sender == admin, "NOT_ALLOWED");
        _allianceRegistry.addMultiplePlayersToAlliance(playerSubmissions);
    }

    function instantiate(
        address initialAdmin,
        AllianceRegistry.PlayerSubmission[] calldata playerSubmissions,
        bytes32 salt
    ) external {
        require(_original, "CANNOT_INSTANTIATE_FROM_CLONES");
        address newAlliance = Clones.cloneDeterministic(address(this), keccak256(abi.encodePacked(salt, msg.sender)));
        BasicAlliance(newAlliance).setAdminAndAddMembers(initialAdmin, playerSubmissions);
    }

    function getAddress(bytes32 salt) external view returns (address) {
        require(_original, "CANNOT_INSTANTIATE_FROM_CLONES");
        return
            Clones.predictDeterministicAddress(
                address(this),
                keccak256(abi.encodePacked(salt, msg.sender)),
                address(this)
            );
    }

    // function requestToJoin(address player, bytes calldata data) external view returns (bool) {
    //     if (player == _initialMember) {
    //         return true;
    //     } else {
    //         bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", "Add ", ));
    //         address signer = digest.recover(signature);
    //         require(_outerspace.allianceJoinTime(signer, this), "ONLY_ALLIANCE_MEMBER_CAN_INVITE");
    //     }
    // }

    // function playerHasLeft(address player) external {

    // }
}
