// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.8.9;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "./Interfaces/IAlliance.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

contract AllianceRegistry is Proxied {
     using ECDSA for bytes32;


    uint8 internal constant MAX_NUM_ALLIANCES = 4;

    mapping(address => mapping(IAlliance => uint256)) internal _allianceNonces;
    struct AllianceRow {
        IAlliance alliance;
        uint96 joinTime;
    }
    struct Alliances {
        AllianceRow alliance0;
        AllianceRow alliance1;
        AllianceRow alliance2;
        AllianceRow alliance3;
    }
    mapping(address => Alliances) internal _alliances;


    event AllianceLink(IAlliance indexed alliance, address indexed player, bool joining);


    function getAllianceData(address player, IAlliance alliance) external view returns (uint96 joinTime, uint256 nonce) {
        nonce = _allianceNonces[player][alliance];

        Alliances storage alliances = _alliances[msg.sender];
        if (alliances.alliance0.alliance == alliance) {
            joinTime = alliances.alliance0.joinTime;
        } else if (alliances.alliance1.alliance == alliance) {
            joinTime = alliances.alliance1.joinTime;
        } else if (alliances.alliance2.alliance == alliance) {
            joinTime = alliances.alliance2.joinTime;
        } else if (alliances.alliance3.alliance == alliance) {
            joinTime = alliances.alliance3.joinTime;
        }
    }

    function havePlayersAnAllianceInCommon(address player1, address player2, uint256 timestamp) external view returns (IAlliance alliance, uint96 joinTime) {
        Alliances storage p1Alliances = _alliances[player1];
        Alliances storage p2Alliances = _alliances[player2];

        AllianceRow[4] memory player1Alliances;
        AllianceRow[4] memory player2Alliances;
        uint256 num1 = 0;
        uint256 num2 = 0;

        for (uint256 i = 0; i < 4; i++) {
            if (i == num1) {
                AllianceRow memory allianceRow;
                if (i == 0) {
                    allianceRow = p1Alliances.alliance0;
                } else if(i==1) {
                    allianceRow = p1Alliances.alliance1;
                } else if(i==2) {
                    allianceRow = p1Alliances.alliance2;
                } else if(i==3) {
                    allianceRow = p1Alliances.alliance3;
                }
                if (address(allianceRow.alliance) == address(0)) {
                    return (IAlliance(address(0)), 0); // the alliance leave ensure that there is no gap // TODO
                }
                player1Alliances[num1 ++] = allianceRow;
            }
            for (uint256 j = 0; j < 4; j++) {
                if (j == num2) {
                    AllianceRow memory allianceRow;
                    if (j == 0) {
                        allianceRow = p2Alliances.alliance0;
                    } else if(j==1) {
                        allianceRow = p2Alliances.alliance1;
                    } else if(j==2) {
                        allianceRow = p2Alliances.alliance2;
                    } else if(j==3) {
                        allianceRow = p2Alliances.alliance3;
                    }
                    if (address(allianceRow.alliance) == address(0)) {
                        return (IAlliance(address(0)), 0); // the alliance leave ensure that there is no gap // TODO
                    }
                    player2Alliances[num2 ++] = allianceRow;
                }

                if (player1Alliances[i].alliance == player2Alliances[j].alliance) {
                    if (player1Alliances[i].joinTime >= player2Alliances[j].joinTime) {
                        if (player1Alliances[i].joinTime < timestamp) {
                            return (player1Alliances[i].alliance, player1Alliances[i].joinTime);
                        } else {
                            alliance = player1Alliances[i].alliance;
                            joinTime = player1Alliances[i].joinTime;
                        }
                    } else {
                        if (player2Alliances[j].joinTime < timestamp) {
                            return (player2Alliances[j].alliance, player2Alliances[j].joinTime);
                        } else {
                            alliance = player2Alliances[j].alliance;
                            joinTime = player2Alliances[j].joinTime;
                        }
                    }
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // FROM PLAYER
    // -----------------------------------------------------------------------------------------------------

    function joinAlliance(IAlliance alliance, bytes calldata data) external returns (bool joined) {
        Alliances storage alliances = _alliances[msg.sender];
        uint256 slot = 0;
        if (address(alliances.alliance0.alliance) != address(0)) {
            slot ++;
        }
        if (address(alliances.alliance1.alliance) != address(0)) {
            slot ++;
        }
        if (address(alliances.alliance2.alliance) != address(0)) {
            slot ++;
        }
        require(address(alliances.alliance3.alliance) == address(0), "MAX_NUM_ALLIANCES_REACHED");

        joined = alliance.requestToJoin(msg.sender, data);
        if (joined) {
            if (slot == 0) {
                alliances.alliance0.alliance = alliance;
                alliances.alliance0.joinTime = uint96(block.timestamp);
            } else if (slot == 1) {
                alliances.alliance1.alliance = alliance;
                alliances.alliance1.joinTime = uint96(block.timestamp);
            } else if (slot == 2) {
                alliances.alliance2.alliance = alliance;
                alliances.alliance2.joinTime = uint96(block.timestamp);
            } else if (slot == 3) {
                alliances.alliance3.alliance = alliance;
                alliances.alliance3.joinTime = uint96(block.timestamp);
            }

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
        IAlliance alliance = IAlliance(msg.sender);

        Alliances storage alliances = _alliances[player];
        uint256 slot = 0;
        if (address(alliances.alliance0.alliance) != address(0)) {
            require(alliances.alliance0.alliance != alliance, "ALREADY_JOINED");
            slot ++;
        }
        if (address(alliances.alliance1.alliance) != address(0)) {
            require(alliances.alliance1.alliance != alliance, "ALREADY_JOINED");
            slot ++;
        }
        if (address(alliances.alliance2.alliance) != address(0)) {
            require(alliances.alliance2.alliance != alliance, "ALREADY_JOINED");
            slot ++;
        }
        require(alliances.alliance3.alliance != alliance, "ALREADY_JOINED");
        require(address(alliances.alliance3.alliance) == address(0), "MAX_NUM_ALLIANCES_REACHED");


        uint256 currentNonce = _allianceNonces[player][alliance];
        require(currentNonce == nonce, "INVALID_NONCE");

        bytes memory message;
        if (nonce == 0) {
            message = abi.encodePacked("\x19Ethereum Signed Message:\n56", "Join Alliance 0x0000000000000000000000000000000000000000");
            _writeUintAsHex(message, 28 + 55, uint160(msg.sender));
        } else {
            message = abi.encodePacked("\x19Ethereum Signed Message:\n76", "Join Alliance 0x0000000000000000000000000000000000000000 (nonce:          0)");
            _writeUintAsHex(message, 28 + 55, uint160(msg.sender));
            _writeUintAsDecimal(message, 28 + 74, nonce);
        }


        console.log(string(message));

        bytes32 digest = keccak256(message);

        address signer = digest.recover(signature);
        require(player == signer, "INVALID_SIGNATURE");

        if (slot == 0) {
            alliances.alliance0.alliance = alliance;
            alliances.alliance0.joinTime = uint96(block.timestamp);
        } else if (slot == 1) {
            alliances.alliance1.alliance = alliance;
            alliances.alliance1.joinTime = uint96(block.timestamp);
        } else if (slot == 2) {
            alliances.alliance2.alliance = alliance;
            alliances.alliance2.joinTime = uint96(block.timestamp);
        } else if (slot == 3) {
            alliances.alliance3.alliance = alliance;
            alliances.alliance3.joinTime = uint96(block.timestamp);
        }
        _allianceNonces[player][alliance] = nonce + 1;

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

        Alliances storage alliances = _alliances[msg.sender];
        uint256 slot = 0;
        if (alliances.alliance0.alliance != alliance) {
            slot ++;
        }
        if (alliances.alliance1.alliance != alliance) {
            slot ++;
        }
        if (alliances.alliance2.alliance != alliance) {
            slot ++;
        }
        require(alliances.alliance3.alliance == alliance, "NOT_PART_OF_THE_ALLIANCE");


        if (slot == 0) {
            alliances.alliance0.alliance = IAlliance(address(0));
            alliances.alliance0.joinTime = 0;
        } else if (slot == 1) {
            alliances.alliance1.alliance = IAlliance(address(0));
            alliances.alliance1.joinTime = 0;
        } else if (slot == 2) {
            alliances.alliance2.alliance = IAlliance(address(0));
            alliances.alliance2.joinTime = 0;
        } else if (slot == 3) {
            alliances.alliance3.alliance = IAlliance(address(0));
            alliances.alliance3.joinTime = 0;
        }

        emit AllianceLink(alliance, player, false);
    }



    function _msgSender() internal view returns (address) {
        return msg.sender; // TODO metatx
    }
}
