// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.9;

library StringUtils {
    bytes internal constant hexAlphabet = "0123456789abcdef";
    bytes internal constant decimalAlphabet = "0123456789";

    function writeUintAsHex(
        bytes memory data,
        uint256 endPos,
        uint256 num
    ) internal pure {
        while (num != 0) {
            data[endPos--] = bytes1(hexAlphabet[num % 16]);
            num /= 16;
        }
    }

    function writeUintAsDecimal(
        bytes memory data,
        uint256 endPos,
        uint256 num
    ) internal pure {
        while (num != 0) {
            data[endPos--] = bytes1(decimalAlphabet[num % 10]);
            num /= 10;
        }
    }
}
