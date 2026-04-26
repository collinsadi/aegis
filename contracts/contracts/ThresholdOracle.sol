// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ThresholdOracle
 * @notice N-of-M quantum threat oracle. Multiple authorized oracles each
 *         submit a threat score for an AegisAccount. When the required number
 *         of votes is reached AND the average score meets the threshold,
 *         the contract autonomously calls deprecateECDSA() on the account.
 *
 * @dev    Designed to be the `oracle` address in newly deployed AegisAccount
 *         contracts. Does not require any changes to AegisAccount.sol.
 *
 *         Flow:
 *           1. Deploy ThresholdOracle with a list of authorized oracle addresses,
 *              the required vote count (quorum), and the threat threshold score.
 *           2. Set ThresholdOracle as the oracle when deploying AegisAccount.
 *           3. When a quantum event occurs, each authorized oracle calls
 *              submitThreat(account, score).
 *           4. Once `quorum` oracles have voted and the average score >= threshold,
 *              ThresholdOracle calls account.deprecateECDSA() automatically.
 *           5. No single oracle can trigger the action alone.
 */

interface IAegisAccount {
    function deprecateECDSA() external;
}

contract ThresholdOracle {
    // ── State ─────────────────────────────────────────────────────────────────

    uint256 public immutable quorum;            // votes required to trigger
    uint256 public immutable threshold;         // average score required (0-100)
    address public immutable admin;             // can add/remove oracles

    mapping(address => bool) public isOracle;
    uint256 public oracleCount;

    // per-account voting state
    struct VoteState {
        mapping(address => uint256) scores;     // oracle => score submitted
        mapping(address => bool)    voted;      // oracle => has voted
        uint256 voteCount;
        uint256 scoreSum;
        bool    triggered;                      // deprecateECDSA already called
    }
    mapping(address => VoteState) private _votes;

    // ── Events ────────────────────────────────────────────────────────────────

    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ThreatSubmitted(address indexed oracle, address indexed account, uint256 score);
    event QuorumReached(address indexed account, uint256 averageScore);
    event ECDSADeprecated(address indexed account);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address[] memory _oracles,
        uint256 _quorum,
        uint256 _threshold
    ) {
        require(_oracles.length > 0, "ThresholdOracle: no oracles");
        require(_quorum > 0 && _quorum <= _oracles.length, "ThresholdOracle: invalid quorum");
        require(_threshold <= 100, "ThresholdOracle: threshold must be 0-100");

        admin     = msg.sender;
        quorum    = _quorum;
        threshold = _threshold;

        for (uint256 i = 0; i < _oracles.length; i++) {
            require(_oracles[i] != address(0), "ThresholdOracle: zero address");
            require(!isOracle[_oracles[i]], "ThresholdOracle: duplicate oracle");
            isOracle[_oracles[i]] = true;
            emit OracleAdded(_oracles[i]);
        }
        oracleCount = _oracles.length;
    }

    // ── Oracle management ─────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ThresholdOracle: not admin");
        _;
    }

    function addOracle(address oracle) external onlyAdmin {
        require(oracle != address(0), "ThresholdOracle: zero address");
        require(!isOracle[oracle], "ThresholdOracle: already oracle");
        isOracle[oracle] = true;
        oracleCount++;
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyAdmin {
        require(isOracle[oracle], "ThresholdOracle: not oracle");
        require(oracleCount > quorum, "ThresholdOracle: would break quorum");
        isOracle[oracle] = false;
        oracleCount--;
        emit OracleRemoved(oracle);
    }

    // ── Threat submission ─────────────────────────────────────────────────────

    /**
     * @notice Submit a quantum threat score for an AegisAccount.
     * @param  account The AegisAccount to potentially deprecate.
     * @param  score   Threat score 0-100. Recommend 70+ for quantum threat.
     */
    function submitThreat(address account, uint256 score) external {
        require(isOracle[msg.sender], "ThresholdOracle: not authorized oracle");
        require(account != address(0), "ThresholdOracle: zero account");
        require(score <= 100, "ThresholdOracle: score must be 0-100");

        VoteState storage state = _votes[account];

        require(!state.triggered, "ThresholdOracle: already triggered for this account");
        require(!state.voted[msg.sender], "ThresholdOracle: oracle already voted");

        state.voted[msg.sender]   = true;
        state.scores[msg.sender]  = score;
        state.voteCount          += 1;
        state.scoreSum           += score;

        emit ThreatSubmitted(msg.sender, account, score);

        // Check quorum and threshold
        if (state.voteCount >= quorum) {
            uint256 average = state.scoreSum / state.voteCount;
            if (average >= threshold) {
                state.triggered = true;
                emit QuorumReached(account, average);
                _executeDeprecation(account);
            }
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _executeDeprecation(address account) internal {
        IAegisAccount(account).deprecateECDSA();
        emit ECDSADeprecated(account);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function getVoteCount(address account) external view returns (uint256) {
        return _votes[account].voteCount;
    }

    function getScoreSum(address account) external view returns (uint256) {
        return _votes[account].scoreSum;
    }

    function isTriggered(address account) external view returns (bool) {
        return _votes[account].triggered;
    }

    function hasVoted(address oracle, address account) external view returns (bool) {
        return _votes[account].voted[oracle];
    }

    function getAverageScore(address account) external view returns (uint256) {
        VoteState storage state = _votes[account];
        if (state.voteCount == 0) return 0;
        return state.scoreSum / state.voteCount;
    }
}
