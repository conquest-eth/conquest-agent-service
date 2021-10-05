// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.8.9;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "./Interfaces/IAlliance.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AllianceRegistry is Proxied {
     using ECDSA for bytes32;


    uint8 internal constant MAX_NUM_ALLIANCES = 8;

    struct AccountData {
        uint8 numAlliances;
        uint32 nonce;
    }
    mapping(address => AccountData) internal _accounts;
    mapping(address => mapping(IAlliance => uint256)) internal _alliances;


    event AllianceLink(IAlliance indexed alliance, address indexed player, bool joining);


    function allianceJoinTime(address player, IAlliance alliance) external view returns(uint256 timestamp) {
        return _alliances[player][alliance];
    }

    function arePlayersAllies(IAlliance alliance, address player1, address player2, uint256 timestamp) external view returns(bool allied) {
        uint256 p1Time = _alliances[player1][alliance];
        if (p1Time == 0 || p1Time > timestamp) {
            return false;
        }
        uint256 p2Time = _alliances[player2][alliance];
        return (p2Time > 0 && p2Time < timestamp);
    }

    // -----------------------------------------------------------------------------------------------------
    // FROM PLAYER
    // -----------------------------------------------------------------------------------------------------

    function joinAlliance(IAlliance alliance, bytes calldata data) external returns (bool joined) {
        uint8 numAlliances = _accounts[msg.sender].numAlliances;
        require(numAlliances < MAX_NUM_ALLIANCES, "MAX_NUM_ALLIANCES_REACHED");
        joined = alliance.requestToJoin(msg.sender, data);
        if (joined) {
            _alliances[msg.sender][alliance] = block.timestamp;
            _accounts[msg.sender].numAlliances  = numAlliances + 1;
            emit AllianceLink(alliance, msg.sender, true);
        }
    }

    function leaveAlliance(IAlliance alliance) external {
        _leaveAlliance(msg.sender, alliance);
        try alliance.playerHasLeft(msg.sender) {} catch {}
        // TODO ensure callback not failed due to low gas (1/64 rule)
    }


    // -----------------------------------------------------------------------------------------------------
    // FROM ALLIANCE
    // -----------------------------------------------------------------------------------------------------

    function addPlayerToAlliance(address player, uint32 nonce, bytes calldata signature) external {
        _addPlayerToAlliance(player, nonce, signature);
    }

    struct PlayerSubmission {
        address addr;
        uint32 nonce;
        bytes signature;
    }


    function addMultiplePlayersToAlliance(PlayerSubmission[] calldata playerSubmissions) external {
       for(uint256 i = 0 ; i < playerSubmissions.length; i++) {
           _addPlayerToAlliance(playerSubmissions[i].addr, playerSubmissions[i].nonce, playerSubmissions[i].signature);
       }
    }

    function ejectPlayerFromAlliance(address player) external {
        _leaveAlliance(player, IAlliance(msg.sender));
    }


    // -----------------------------------------------------------------------------------------------------
    // INTERNAL
    // -----------------------------------------------------------------------------------------------------

    function _addPlayerToAlliance(address player, uint32 nonce, bytes calldata signature) internal {
        uint8 numAlliances = _accounts[player].numAlliances;
        uint32 currentNonce = _accounts[player].nonce;
        require(currentNonce == nonce, "INVALID_NONCE");
        require(numAlliances < MAX_NUM_ALLIANCES, "MAX_NUM_ALLIANCES_REACHED");
        IAlliance alliance = IAlliance(msg.sender);


        bytes memory message = abi.encodePacked("\x19Ethereum Signed Message:\n76", "Join Alliance 0x0000000000000000000000000000000000000000 (nonce: 0000000000)");
        _writeUintAsHex(message, 28 + 55, uint160(msg.sender));
        _writeUintAsDecimal(message, 28 + 74, nonce);

        bytes32 digest = keccak256(message);

        address signer = digest.recover(signature);
        require(player == signer, "INVALID_SIGNATURE");

        _alliances[player][alliance] = block.timestamp;
        _accounts[player].numAlliances  = numAlliances + 1;
        emit AllianceLink(alliance, player, true);
    }

    bytes internal constant hexAlphabet = "0123456789abcdef";
    bytes internal constant decimalAlphabet = "0123456789";
    function _writeUintAsHex(
        bytes memory data,
        uint256 endPos,
        uint256 num
    ) internal pure {
        while (num != 0) {
            data[endPos--] = bytes1(hexAlphabet[num % 16]);
            num /= 16;
        }
    }
    function _writeUintAsDecimal(
        bytes memory data,
        uint256 endPos,
        uint256 num
    ) internal pure {
        while (num != 0) {
            data[endPos--] = bytes1(decimalAlphabet[num % 10]);
            num /= 10;
        }
    }

    function _leaveAlliance(address player, IAlliance alliance) internal {
        uint256 joinTime = _alliances[player][alliance];
        require(joinTime > 0, "NOT_PART_OF_THE_ALLIANCE");
        _alliances[player][alliance] = 0;
        _accounts[player].numAlliances --;
        emit AllianceLink(alliance, player, false);
    }



    function _msgSender() internal view returns (address) {
        return msg.sender; // TODO metatx
    }
}
