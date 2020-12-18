// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ERC2612.sol";

interface ERC20With2612 is IERC20, ERC2612 {}
