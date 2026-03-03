import { MinorityGameService } from './service';

async function main() {
  console.log('=== Fetching Active Polls ===\n');
  const service = new MinorityGameService();

  try {
    const polls = await service.fetchActivePolls();
    console.log('Active Polls:');
    console.log(JSON.stringify(polls, null, 2));

    if (polls.length === 0) {
      console.log('\nNo active polls found.');
      return;
    }

    console.log(`\nFound ${polls.length} active poll(s):\n`);
    polls.forEach((poll: any, index: number) => {
      console.log(`--- Poll ${index + 1} ---`);
      console.log(`ID (Database): ${poll.id}`);
      console.log(`On-Chain ID: ${poll.on_chain_id}`);
      console.log(`Title: ${poll.title}`);
      console.log(`Description: ${poll.description || 'N/A'}`);
      console.log(`Option A: ${poll.option_a}`);
      console.log(`Option B: ${poll.option_b}`);
      console.log(`Created At: ${poll.created_at}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('Error fetching polls:', error.message);
    process.exit(1);
  }
}

main();
