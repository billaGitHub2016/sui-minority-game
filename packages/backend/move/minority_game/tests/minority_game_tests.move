
#[test_only]
module minority_game::minority_game_tests {
    use sui::test_scenario;
    use sui::clock::{Self};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::hash::blake2b256;
    use std::vector;
    use minority_game::minority_game::{Self, Poll, AdminCap};

    const ADMIN: address = @0xA;
    const ALICE: address = @0xB;
    const BOB: address = @0xC;
    const CHARLIE: address = @0xD;

    fun make_hash(choice: vector<u8>, salt: vector<u8>): vector<u8> {
        let mut data = vector::empty<u8>();
        vector::append(&mut data, choice);
        vector::append(&mut data, salt);
        blake2b256(&data)
    }

    #[test]
    fun test_minority_wins_with_reveal() {
        let mut scenario = test_scenario::begin(ADMIN);
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // 0. Init (Create AdminCap)
        {
            minority_game::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // 1. Create Poll
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            minority_game::create_poll(
                b"Tabs or Spaces?",
                b"Tabs",
                b"Spaces",
                &clock,
                test_scenario::ctx(&mut scenario)
            );
        };

        // 2. Voting Phase (Commit)
        let alice_salt = b"salt1";
        let bob_salt = b"salt2";
        let charlie_salt = b"salt3";

        // Alice commits "Tabs"
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut poll = test_scenario::take_shared<Poll>(&scenario);
            let payment = coin::mint_for_testing<SUI>(100_000_000, test_scenario::ctx(&mut scenario));
            let hash = make_hash(b"Tabs", alice_salt);
            minority_game::commit_vote(&mut poll, hash, payment, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(poll);
        };

        // Bob commits "Spaces"
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut poll = test_scenario::take_shared<Poll>(&scenario);
            let payment = coin::mint_for_testing<SUI>(100_000_000, test_scenario::ctx(&mut scenario));
            let hash = make_hash(b"Spaces", bob_salt);
            minority_game::commit_vote(&mut poll, hash, payment, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(poll);
        };

        // Charlie commits "Spaces"
        test_scenario::next_tx(&mut scenario, CHARLIE);
        {
            let mut poll = test_scenario::take_shared<Poll>(&scenario);
            let payment = coin::mint_for_testing<SUI>(100_000_000, test_scenario::ctx(&mut scenario));
            let hash = make_hash(b"Spaces", charlie_salt);
            minority_game::commit_vote(&mut poll, hash, payment, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(poll);
        };

        // 3. Fast Forward to Reveal Phase (60 mins + 1 ms)
        clock::increment_for_testing(&mut clock, 60 * 60 * 1000 + 1);

        // 4. Reveal Phase - Admin reveals on behalf of users
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let mut poll = test_scenario::take_shared<Poll>(&scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
            
            // Reveal Alice
            minority_game::reveal_vote(&admin_cap, &mut poll, ALICE, b"Tabs", alice_salt, &clock, test_scenario::ctx(&mut scenario));
            
            // Reveal Bob
            minority_game::reveal_vote(&admin_cap, &mut poll, BOB, b"Spaces", bob_salt, &clock, test_scenario::ctx(&mut scenario));
            
            // Reveal Charlie
            minority_game::reveal_vote(&admin_cap, &mut poll, CHARLIE, b"Spaces", charlie_salt, &clock, test_scenario::ctx(&mut scenario));
            
            test_scenario::return_shared(poll);
            test_scenario::return_to_sender(&scenario, admin_cap);
        };

        // 5. Fast Forward to Claim Phase (Total 10 mins + 1 ms)
        clock::increment_for_testing(&mut clock, 10 * 60 * 1000 + 1);

        // 6. Claim Reward (Alice Wins)
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut poll = test_scenario::take_shared<Poll>(&scenario);
            minority_game::claim_reward(&mut poll, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(poll);
        };

        // Verify Alice's reward
        // Total Pool = 3 * 99_000_000 = 297_000_000
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let reward = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&reward) == 297_000_000, 0);
            test_scenario::return_to_sender(&scenario, reward);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}
