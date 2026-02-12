
module minority_game::minority_game {
    use std::string::{Self, String};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use std::vector;
    use sui::hash::blake2b256;

    const E_POLL_ENDED: u64 = 0;
    const E_POLL_NOT_ENDED: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_ALREADY_VOTED: u64 = 3;
    const E_NOT_VOTED: u64 = 4;
    const E_ALREADY_CLAIMED: u64 = 5;
    const E_NOT_WINNER: u64 = 6;
    const E_INVALID_PHASE: u64 = 7;
    const E_INVALID_REVEAL: u64 = 8;
    const E_ALREADY_REVEALED: u64 = 9;

    const STAKE_AMOUNT: u64 = 100_000_000; // 0.1 SUI
    const FEE_AMOUNT: u64 = 1_000_000; // 0.001 SUI (1% of 0.1 SUI)
    const NET_STAKE: u64 = 99_000_000; // 0.099 SUI

    const DURATION: u64 = 120 * 1000; // 2 minutes Voting Phase
    const REVEAL_DURATION: u64 = 60 * 1000; // 1 minute Reveal Phase

    public struct AdminCap has key, store {
        id: UID
    }

    public struct VoteCommit has store, drop {
        vote_hash: vector<u8>,
        revealed: bool,
        choice: String // Empty until revealed
    }

    public struct Poll has key, store {
        id: UID,
        question: String,
        option_a: String,
        option_b: String,
        count_a: u64,
        count_b: u64,
        total_votes: u64, // Track total commitments for pool calc
        created_at: u64,
        pool: Balance<SUI>,
        fees: Balance<SUI>,
        votes: Table<address, VoteCommit>, // Store Commitments
        claimed: Table<address, bool>, 
    }

    public struct VoteEvent has copy, drop {
        poll_id: ID,
        voter: address,
        // No choice revealed here!
    }

    public struct RevealEvent has copy, drop {
        poll_id: ID,
        voter: address,
        choice: String
    }

    public struct ClaimEvent has copy, drop {
        poll_id: ID,
        voter: address,
        amount: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
    }

    public entry fun create_poll(
        question: vector<u8>,
        option_a: vector<u8>,
        option_b: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let poll = Poll {
            id: object::new(ctx),
            question: string::utf8(question),
            option_a: string::utf8(option_a),
            option_b: string::utf8(option_b),
            count_a: 0,
            count_b: 0,
            total_votes: 0,
            created_at: clock::timestamp_ms(clock),
            pool: balance::zero(),
            fees: balance::zero(),
            votes: table::new(ctx),
            claimed: table::new(ctx),
        };
        transfer::share_object(poll);
    }

    // Phase 1: Commit Vote (Hash)
    public entry fun commit_vote(
        poll: &mut Poll,
        vote_hash: vector<u8>,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if in Voting Phase
        assert!(clock::timestamp_ms(clock) < poll.created_at + DURATION, E_POLL_ENDED);
        
        // Check payment
        let value = coin::value(&payment);
        assert!(value >= STAKE_AMOUNT, E_INVALID_AMOUNT);

        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&poll.votes, sender), E_ALREADY_VOTED);

        // Process payment (take fee now)
        let mut coin_balance = coin::into_balance(payment);
        let stake = balance::split(&mut coin_balance, STAKE_AMOUNT);
        let mut stake_coin = coin::from_balance(stake, ctx);
        let fee_coin = coin::split(&mut stake_coin, FEE_AMOUNT, ctx);
        
        balance::join(&mut poll.fees, coin::into_balance(fee_coin));
        balance::join(&mut poll.pool, coin::into_balance(stake_coin));
        
        if (balance::value(&coin_balance) > 0) {
            transfer::public_transfer(coin::from_balance(coin_balance, ctx), sender);
        } else {
            balance::destroy_zero(coin_balance);
        };

        // Record Commitment
        let commit = VoteCommit {
            vote_hash: vote_hash,
            revealed: false,
            choice: string::utf8(b"")
        };
        table::add(&mut poll.votes, sender, commit);
        poll.total_votes = poll.total_votes + 1;

        event::emit(VoteEvent {
            poll_id: object::uid_to_inner(&poll.id),
            voter: sender,
        });
    }

    public struct DebugEvent has copy, drop {
        msg: String,
        bytes: vector<u8>
    }

    // Phase 2: Reveal Vote
    public entry fun reveal_vote(
        poll: &mut Poll,
        choice: vector<u8>,
        salt: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if in Reveal Phase (Voting Ended < Now < Reveal Ended)
        let now = clock::timestamp_ms(clock);
        assert!(now >= poll.created_at + DURATION, E_INVALID_PHASE); 
        // Allow reveal only during Reveal Phase
        assert!(now < poll.created_at + DURATION + REVEAL_DURATION, E_POLL_ENDED);

        let sender = tx_context::sender(ctx);
        assert!(table::contains(&poll.votes, sender), E_NOT_VOTED);

        let commit = table::borrow_mut(&mut poll.votes, sender);
        assert!(!commit.revealed, E_ALREADY_REVEALED);

        // Verify Hash: hash(choice + salt) == commit.vote_hash
        let mut data = vector::empty<u8>();
        vector::append(&mut data, choice);
        vector::append(&mut data, salt);
        let computed_hash = blake2b256(&data);
        
        assert!(computed_hash == commit.vote_hash, E_INVALID_REVEAL);

        let choice_str = string::utf8(choice);
        
        // Debugging Events
        event::emit(DebugEvent { msg: string::utf8(b"Revealed Choice"), bytes: choice });
        event::emit(DebugEvent { msg: string::utf8(b"Option A"), bytes: *string::bytes(&poll.option_a) });
        event::emit(DebugEvent { msg: string::utf8(b"Option B"), bytes: *string::bytes(&poll.option_b) });

        // Update Counts
        if (choice_str == poll.option_a) {
            poll.count_a = poll.count_a + 1;
        } else if (choice_str == poll.option_b) {
            poll.count_b = poll.count_b + 1;
        };

        commit.revealed = true;
        commit.choice = choice_str;

        event::emit(RevealEvent {
            poll_id: object::uid_to_inner(&poll.id),
            voter: sender,
            choice: choice_str
        });
    }

    // Phase 3: Claim Reward
    public entry fun claim_reward(
        poll: &mut Poll,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check if Reveal Phase Ended
        let now = clock::timestamp_ms(clock);
        assert!(now >= poll.created_at + DURATION + REVEAL_DURATION, E_POLL_NOT_ENDED);

        let sender = tx_context::sender(ctx);
        
        assert!(table::contains(&poll.votes, sender), E_NOT_VOTED);
        assert!(!table::contains(&poll.claimed, sender), E_ALREADY_CLAIMED);

        let commit = table::borrow(&poll.votes, sender);
        // Must have revealed to claim
        assert!(commit.revealed, E_NOT_VOTED); 
        let user_choice = commit.choice;
        
        let is_a_minority = poll.count_a < poll.count_b;
        let mut reward_amount = 0;
        let is_draw = poll.count_a == poll.count_b;

        if (is_draw) {
            reward_amount = NET_STAKE;
        } else {
            let winning_choice = if (is_a_minority) { poll.option_a } else { poll.option_b };
            
            // Check if user won
            assert!(user_choice == winning_choice, E_NOT_WINNER);

            let winner_count = if (is_a_minority) { poll.count_a } else { poll.count_b };
            
            // Logic: Total Pool Value / Winner Count
            // Note: Total Pool includes unrevealed stakes.
            // Since we don't track historical pool value, we calculate based on Total Votes.
            // But some might have been refunded? No refunds here except draw.
            // Total Pool = total_votes * NET_STAKE.
            // However, balance::value(&poll.pool) is the source of truth.
            // But balance decreases as people claim.
            // So we CANNOT use balance::value(&poll.pool) / winner_count directly if claims are async.
            // We MUST calculate the fixed reward amount PER WINNER.
            
            // Fixed Reward = (Total Votes * NET_STAKE) / Winner Count
            let total_pool_val = poll.total_votes * NET_STAKE;
            
            // Integer division floor
            reward_amount = total_pool_val / winner_count;
        };

        // Mark as claimed
        table::add(&mut poll.claimed, sender, true);

        // Transfer reward
        let reward = balance::split(&mut poll.pool, reward_amount);
        transfer::public_transfer(coin::from_balance(reward, ctx), sender);

        event::emit(ClaimEvent {
            poll_id: object::uid_to_inner(&poll.id),
            voter: sender,
            amount: reward_amount,
        });
    }

    public entry fun withdraw_fees(
        _: &AdminCap,
        poll: &mut Poll,
        ctx: &mut TxContext
    ) {
        let amount = balance::value(&poll.fees);
        let fee_coins = coin::from_balance(balance::split(&mut poll.fees, amount), ctx);
        transfer::public_transfer(fee_coins, tx_context::sender(ctx));
    }
}
