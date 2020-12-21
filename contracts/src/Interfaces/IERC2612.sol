// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IERC2612Standalone.sol";

interface IERC2612 is IERC2612Standalone, IERC20 {}
