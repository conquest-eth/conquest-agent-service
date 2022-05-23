// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./ConquestToken.sol";

contract ConquestStakingPool {
    struct Config {
        uint64 maxInflation;
        // 0 and the curve is linear, means inflation moves with the stake and staker win the same ratio at all time
        // > 0 , means inflation start higher giving more to early stakers
        uint64 startInflation;
        uint64 liquidityRewardRatio;
    }

    uint256 internal constant PRECISION = 1e24;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 reward);
    event StakeTransfered(address indexed from, address indexed to, uint256 amount);

    uint256 internal _lastUpdateTime;
    uint256 internal _totalRewardPerTokenAtLastUpdate;
    uint256 internal _totalStaked;
    uint256 internal _extraTokenGenerated;
    uint256 internal _totalLiquidityRewardGenerated;

    mapping(address => uint256) internal _amountStakedPerAccount;
    mapping(address => uint256) internal _totalRewardPerTokenAccountedPerAccount;
    mapping(address => uint256) internal _rewardsToWithdrawPerAccount;

    mapping(address => uint256) internal _games;
    address public owner;

    // ---------------------------------------------------------------------------------------------------------------
    // CONFIG
    // ---------------------------------------------------------------------------------------------------------------
    Config public config;
    // ---------------------------------------------------------------------------------------------------------------

    ConquestToken internal immutable _conquestToken;
    uint256 internal immutable _originalTotalSupply;

    constructor(ConquestToken conquestToken, address initialOwner) {
        _conquestToken = conquestToken;
        _originalTotalSupply = _conquestToken.totalSupply();
        owner = initialOwner;

        // -----------------------------------------------------------------------------------------------------------
        // CONFIG
        // -----------------------------------------------------------------------------------------------------------
        config.startInflation = 0; // TODO configure 10000th
        config.maxInflation = 2000; // TODO configure 10000th
        config.liquidityRewardRatio = 5000; // TODO configure 10000th
        // -----------------------------------------------------------------------------------------------------------
    }

    // TODO implement game weight
    function setGame(address game, uint256 weight) external {
        require(msg.sender == owner, "NOT_OWNER");
        _games[game] = weight;
    }

    // TODO Ownable with Event
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "NOT_OWNER");
        owner = newOwner;
    }

    function setConfig(Config calldata newConfig) external {
        require(msg.sender == owner, "NOT_OWNER");
        _updateGlobal();
        config = newConfig;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // For Authorized Games
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice stake ${amount} tokens from account ${account}.
    /// @param account The account whose token are staked. Will be given reward.
    /// @param amount The amount of tokens to stake.
    function stake(address account, uint256 amount) external onlyGames {
        if (amount == 0) {
            return;
        }

        (uint256 totalStakedSoFar, uint256 amountStakedSoFar) = _update(account);

        // update staked amount, their reward will be counted on next interaction.
        _totalStaked = totalStakedSoFar + amount; // WRITE + 1 // TODO remove that line because _conquestToken.balanceOf(address(this)) should be equivalent
        _amountStakedPerAccount[account] = amountStakedSoFar + amount; // WRITE + 1

        _conquestToken.transferFrom(account, address(this), amount); // WRITE + 2 + ?
        emit Staked(account, amount);
    }

    // /// @notice Withdraws ${amount} staked tokens from account ${account}.
    // /// @param account The account whose token are withdrawn.
    // /// @param amount The amount of tokens to withdraw.
    // function withdraw(address account, uint256 amount) external onlyGames {
    //     if (amount == 0) {
    //         return;
    //     }

    //     // update the amount generated, store it in
    //     (uint256 totalStakedSoFar, uint256 amountStakedSoFar) = _update(account);

    //     unchecked {
    //         _amountStakedPerAccount[account] = amountStakedSoFar - amount;
    //         _totalStaked = totalStakedSoFar - amount;
    //     }

    //     _conquestToken.transfer(account, amount);
    //     emit Withdrawn(account, amount);
    // }

    /// @notice Withdraws ${amount} staked tokens from account ${account}.
    /// @param account The account whose token are withdrawn.
    /// @param amount The amount of tokens to withdraw.
    function exit(address account, uint256 amount) external onlyGames {
        if (amount == 0) {
            return;
        }

        // update the amount generated, store it in
        (uint256 totalStakedSoFar, uint256 amountStakedSoFar) = _update(account);

        unchecked {
            _amountStakedPerAccount[account] = amountStakedSoFar - amount;
            _totalStaked = totalStakedSoFar - amount;
        }

        // TODO exit reserve (if someone capture)
        // _conquestToken.transfer(account, amount);

        // emit Withdrawn(account, amount);
    }

    /// @notice Withdraws ${amount} staked tokens from account ${account}.
    /// @param account The account whose token are withdrawn.
    /// @param amount The amount of tokens to withdraw.
    function withdraw(address account, uint256 amount) external onlyGames {
        // TODO  take from exit reserve
        _conquestToken.transfer(account, amount);
        emit Withdrawn(account, amount);
    }

    // TODO variant where you can withdraw an amount of token + an amount of reward at the same time (not full exit)

    /// @notice Transfers ${amount} staked token to another account. Rewards acrrued are given to account ${from} first.
    /// @param from account to transfer from
    /// @param to account to transfer to
    /// @param amount The amount of staked tokens to transfer
    function transfer(
        address from,
        address to,
        uint256 amount
    ) external onlyGames {
        if (amount == 0) {
            return;
        }
        if (from == to) {
            return;
        }

        (uint256 totalStakedSoFar, uint256 totalRewardPerToken, ) = _updateGlobal();
        uint256 amountStakedSoFar;
        unchecked {
            amountStakedSoFar = _updateAccount(from, totalRewardPerToken);
            _amountStakedPerAccount[from] = amountStakedSoFar - amount;
            amountStakedSoFar = _updateAccount(to, totalRewardPerToken);
            _amountStakedPerAccount[to] = amountStakedSoFar + amount;
        }

        emit StakeTransfered(from, to, amount);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // For Accounts
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice Withdraws all earned rewards
    function getReward() external {
        uint256 amountStakedSoFar = _amountStakedPerAccount[msg.sender];

        (uint256 totalStakedSoFar, uint256 totalRewardPerToken, ) = _updateGlobal();
        uint256 reward = _computeTokenEarned(
            _totalRewardPerTokenAccountedPerAccount[msg.sender],
            amountStakedSoFar,
            totalRewardPerToken,
            _rewardsToWithdrawPerAccount[msg.sender]
        );
        _totalRewardPerTokenAccountedPerAccount[msg.sender] = totalRewardPerToken;

        if (reward > 0) {
            _rewardsToWithdrawPerAccount[msg.sender] = 0;
            _conquestToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------------------------------------------

    // TODO balanceOf
    // TODO totalSupply
    // ... ?

    /// @notice The amount of reward tokens each staked token has earned so far
    function totalRewardPerToken() external view returns (uint256) {
        uint256 totalStakedSoFar = _totalStaked;
        uint256 extraTokenGenerated = _extraTokenGenerated;
        uint256 totalSupplySoFar = _originalTotalSupply + extraTokenGenerated;
        // TODO add in extraTokenGenerated based on previous rewardRate ?
        uint256 rewardRate = _computeRewardRate(
            totalStakedSoFar,
            totalSupplySoFar,
            config.startInflation,
            config.maxInflation
        );
        return
            _totalRewardPerTokenAtLastUpdate +
            _computeExtraTotalRewardPerTokenSinceLastTime(totalStakedSoFar, rewardRate, _lastUpdateTime);
    }

    /// @notice The amount of reward tokens an account has accrued so far. Does not include already withdrawn rewards.
    function earned(address account) external view returns (uint256) {
        uint256 totalStakedSoFar = _totalStaked;
        uint256 extraTokenGenerated = _extraTokenGenerated;
        uint256 totalSupplySoFar = _originalTotalSupply + extraTokenGenerated;
        // TODO add in extraTokenGenerated based on previous rewardRate ?
        uint256 rewardRate = _computeRewardRate(
            totalStakedSoFar,
            totalSupplySoFar,
            config.startInflation,
            config.maxInflation
        );
        return
            _computeTokenEarned(
                _totalRewardPerTokenAccountedPerAccount[account],
                _amountStakedPerAccount[account],
                _totalRewardPerTokenAtLastUpdate +
                    _computeExtraTotalRewardPerTokenSinceLastTime(totalStakedSoFar, rewardRate, _lastUpdateTime),
                _rewardsToWithdrawPerAccount[account]
            );
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------------------------------

    function _computeRewardRate(
        uint256 totalStakedSoFar,
        uint256 totalSupplySoFar,
        uint256 startInflation,
        uint256 maxInflation
    ) internal pure returns (uint256 rewardRate) {
        // assume this is the only generator of token
        // TODO separate role and have a central place to reserve tokens in ConquestToken
        // claiming reward fro reserve will reduce the reserve while increasing the token minted, keeping total supply adjusted
        uint256 targetRate = (maxInflation - startInflation) * (totalStakedSoFar / totalSupplySoFar) + startInflation;
        rewardRate = (targetRate * totalSupplySoFar) / 315360000000; // number of seconds in a year multiple by 10,000
    }

    function _computeTokenEarned(
        uint256 totalRewardPerTokenAccountedSoFar,
        uint256 accountStakedAmount,
        uint256 currentTotalRewardPerToken,
        uint256 accountRewardsSoFar
    ) internal pure returns (uint256) {
        return
            accountRewardsSoFar +
            ((accountStakedAmount * (currentTotalRewardPerToken - totalRewardPerTokenAccountedSoFar)) / PRECISION);
    }

    // TODO make it pure and totalStaked == 0 check outside ?
    function _computeExtraTotalRewardPerTokenSinceLastTime(
        uint256 totalStaked,
        uint256 rewardRate,
        uint256 lastUpdateTime
    ) internal view returns (uint256) {
        if (totalStaked == 0) {
            return 0;
        }
        return ((block.timestamp - lastUpdateTime) * rewardRate * PRECISION) / totalStaked;
    }

    function _updateGlobal()
        internal
        returns (
            uint256 totalStakedSoFar,
            uint256 totalRewardPerTokenAllocatedSoFar,
            uint256 rewardRate
        )
    {
        totalStakedSoFar = _totalStaked; // READ + 1
        uint256 extraTokenGenerated = _extraTokenGenerated; // READ + 1
        uint256 totalSupplySoFar = _originalTotalSupply + extraTokenGenerated; // READ + 1

        // reward rate for players based on past data, do not consider the compounding effect that should reduce its rate
        // TODO apply it twice? see below
        rewardRate = _computeRewardRate(totalStakedSoFar, totalSupplySoFar, config.startInflation, config.maxInflation); // READ config

        // recompute rewardRate based on aproximate computation of extraTotalRewardPerToken
        // uint256 extraTotalRewardPerToken = _computeExtraTotalRewardPerTokenSinceLastTime(totalStakedSoFar, rewardRate, _lastUpdateTime);
        // rewardRate = _computeRewardRate(totalStakedSoFar + extraTotalRewardPerToken * totalStakedSoFar, totalSupplySoFar);

        uint256 extraTotalRewardPerToken = _computeExtraTotalRewardPerTokenSinceLastTime(
            totalStakedSoFar,
            rewardRate,
            _lastUpdateTime
        ); // READ + 1

        // liquidity reward
        uint256 liquidityRewardPerToken = _computeExtraTotalRewardPerTokenSinceLastTime(
            totalStakedSoFar,
            (rewardRate * config.liquidityRewardRatio) / 10000,
            _lastUpdateTime
        ); // READ + 1 // READ config?
        uint256 liquidityRewardGenerated = liquidityRewardPerToken * totalStakedSoFar;
        _totalLiquidityRewardGenerated = _totalLiquidityRewardGenerated + liquidityRewardGenerated; // WRITE + 1

        totalRewardPerTokenAllocatedSoFar = _totalRewardPerTokenAtLastUpdate + extraTotalRewardPerToken; // READ + 1 // need for returns params

        _extraTokenGenerated =
            extraTokenGenerated +
            (extraTotalRewardPerToken * totalStakedSoFar) +
            liquidityRewardGenerated; // WRITE + 1 // TODO use mint ? => _conquestToken.totalSupply

        // TODO group these 2 in a struct
        _totalRewardPerTokenAtLastUpdate = totalRewardPerTokenAllocatedSoFar; // WRITE + 1
        _lastUpdateTime = block.timestamp; // WRITE + 1
    }

    function _updateAccount(address account, uint256 totalRewardPerTokenAllocatedSoFar)
        internal
        returns (uint256 amountStakedSoFar)
    {
        amountStakedSoFar = _amountStakedPerAccount[account]; // READ: +1 (the amount staked so far)

        _rewardsToWithdrawPerAccount[account] = _computeTokenEarned( // WRITE: +1 (update the reward that can be withdrawn, catching up account state to global)
            _totalRewardPerTokenAccountedPerAccount[account], // READ: +1 (last checkpoint : when was the account last updated)
            amountStakedSoFar,
            totalRewardPerTokenAllocatedSoFar,
            _rewardsToWithdrawPerAccount[account] // READ: +1 (rewards already registered)
        );
        _totalRewardPerTokenAccountedPerAccount[account] = totalRewardPerTokenAllocatedSoFar; // WRITE: +1
    }

    function _update(address account) internal returns (uint256, uint256) {
        (uint256 totalStakedSoFar, uint256 totalRewardPerTokenAllocatedSoFar, ) = _updateGlobal();
        uint256 accountAmountStakedSoFar = _updateAccount(account, totalRewardPerTokenAllocatedSoFar);
        return (totalStakedSoFar, accountAmountStakedSoFar);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------------------------------------------------

    modifier onlyGames() {
        require(_games[msg.sender] > 0, "NOT_AUTHORIZED_GAME");
        _;
    }
}
