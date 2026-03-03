import { MinorityGameService } from './service';
import { getConfig } from './config';

async function main() {
  console.log('--- Starting Minority Game Skill Test ---');
  
  try {
    const config = getConfig();
    console.log(`Loaded Config:
      Network: ${config.network}
      Package: ${config.packageId}
      Sender: ${config.keypair.getPublicKey().toSuiAddress()}
      API URL: ${config.apiUrl}
    `);

    const service = new MinorityGameService();
    
    // Test Salt Generation
    const salt = service.generateSalt();
    console.log('Generated Salt:', salt);

    // Mock Poll ID (User needs to provide a real one for actual test)
    // For now we just verify config and salt gen works.
    // If user provides a poll ID in args, we try to vote.
    const pollId = process.argv[2];
    
    if (pollId) {
      console.log(`Attempting to vote on Poll: ${pollId}`);
      const choice = "Option A"; // Hardcoded for test
      console.log(`Choice: ${choice}`);
      
      const result = await service.commitVote(pollId, choice, salt);
      console.log('Vote Result:', result);
    } else {
      console.log('No Poll ID provided. Skipping vote transaction.');
      console.log('Usage: ts-node src/test.ts <POLL_OBJECT_ID>');
    }

  } catch (e) {
    console.error('Test Failed:', e);
  }
}

main();
