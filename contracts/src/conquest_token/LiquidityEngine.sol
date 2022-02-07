// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "../uniswap/interfaces/IUniswapV2PairWithRawLiquidityProvisionOption.sol";

contract LiquidityEngine {
    using SafeERC20 for IERC20;

    uint256 internal constant DECIMALS_18 = 10**18;

    IWETH internal immutable _WETH;
    IERC20 internal immutable _userProvidedToken;
    IERC20 internal immutable _systemProvidedToken;
    uint256 internal immutable _tokenRatio18;
    IUniswapV2Factory internal immutable _factory;
    address internal immutable _liquidityReserve;

    // receive() external payable {
    //     assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    // }

    constructor(
        IWETH weth,
        IUniswapV2Factory factory,
        IERC20 userProvidedToken,
        IERC20 systemProvidedToken,
        uint256 tokenRatio18,
        address liquidityReserve
    ) {
        _WETH = weth;
        _factory = factory;
        _userProvidedToken = userProvidedToken;
        _systemProvidedToken = systemProvidedToken;
        _tokenRatio18 = tokenRatio18;
        _liquidityReserve = liquidityReserve;
    }

    function addLiquidity(
        uint256 upToAmountA,
        address to,
        uint256 deadline
    )
        external
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        uint256 upToAmountB = (upToAmountA * _tokenRatio18) / DECIMALS_18;
        uint256 balance = _systemProvidedToken.balanceOf(address(this));
        if (balance < upToAmountB) {
            amountB = balance;
        } else {
            amountB = upToAmountB;
        }
        amountA = (amountB * DECIMALS_18) / _tokenRatio18;

        address pair = _factory.getPair(address(_userProvidedToken), address(_systemProvidedToken));
        if (pair == address(0)) {
            pair = _factory.createPair(address(_userProvidedToken), address(_systemProvidedToken));
        }

        _userProvidedToken.safeTransferFrom(msg.sender, pair, amountA);
        _systemProvidedToken.safeTransferFrom(address(this), pair, amountB);
        liquidity = IUniswapV2PairWithRawLiquidityProvisionOption(pair).mintWithRawLiquidityProvision(
            to,
            _liquidityReserve
        );
    }

    function addLiquidityETH(address to, uint256 deadline)
        external
        payable
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        require(address(_userProvidedToken) == address(_WETH), "NO_ETH_EXPECTED");
        uint256 upToAmountB = (msg.value * _tokenRatio18) / DECIMALS_18;
        uint256 balance = _systemProvidedToken.balanceOf(address(this));
        if (balance < upToAmountB) {
            amountB = balance;
        } else {
            amountB = upToAmountB;
        }
        amountA = (amountB * DECIMALS_18) / _tokenRatio18;

        address pair = _factory.getPair(address(_userProvidedToken), address(_systemProvidedToken));
        if (pair == address(0)) {
            pair = _factory.createPair(address(_userProvidedToken), address(_systemProvidedToken));
        }

        _WETH.deposit{value: amountA}();
        require(_WETH.transfer(pair, amountA), "WETH_FAILED");
        _systemProvidedToken.safeTransferFrom(address(this), pair, amountB);

        liquidity = IUniswapV2PairWithRawLiquidityProvisionOption(pair).mintWithRawLiquidityProvision(
            to,
            _liquidityReserve
        );

        if (msg.value > amountA) {
            payable(msg.sender).transfer(msg.value - amountA);
        }
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "LiquidityEngine: EXPIRED");
        _;
    }
}
