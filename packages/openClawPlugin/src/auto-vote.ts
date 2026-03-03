import { MinorityGameService } from './service';
import { MinorityGameStrategy } from './strategy';

const POLL_DURATION = 3600 * 1000; // 60 minutes

async function main() {
  console.log('=== Auto Vote Strategy ===\n');
  const service = new MinorityGameService();
  const strategy = new MinorityGameStrategy();

  try {
    // 1. Fetch polls
    const polls = await service.fetchActivePolls();

    if (polls.length === 0) {
      console.log('No active polls found.');
      return;
    }

    console.log(`Found ${polls.length} active poll(s).\n`);

    // 2. Process each poll
    for (const poll of polls) {
      console.log(`--- Processing Poll: ${poll.title} ---`);

      try {
        // A. Analyze
        console.log('\nAnalyzing poll...');
        const analysis = await strategy.predictMinority(poll);
        console.log(`Prediction: ${analysis.choice}`);
        console.log(`Reason: ${analysis.reason}\n`);

        // B. Generate Salt
        const salt = service.generateSalt();
        console.log(`Generated salt: ${salt}`);

        // C. Vote
        console.log('Committing vote...');
        const voteResult = await service.commitVote(
          poll.on_chain_id,
          analysis.choice,
          salt,
          poll.id, // Pass the database UUID for backup
          new Date(poll.created_at).getTime() + POLL_DURATION // Pass poll end time for timelock encryption
        );

        console.log(`\n✅ Vote succeeded!`);
        console.log(`Transaction: ${JSON.stringify(voteResult, null, 2)}\n`);

      } catch (e: any) {
        console.error(`\n❌ Failed to vote on poll "${poll.title}":`, e.message);
        console.log('');
      }

      break; // For this run, vote on only one poll
    }

    console.log('=== Auto Vote Complete ===');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
