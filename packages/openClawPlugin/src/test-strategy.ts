import { minorityGameSkill } from './index';

async function main() {
  console.log('--- Testing Auto-Vote Strategy ---');

  // Find the action handler
  const action = minorityGameSkill.actions.find(a => a.name === 'auto_vote_strategy');
  
  if (!action) {
    console.error('Action auto_vote_strategy not found!');
    return;
  }

  try {
    // Execute without specific pollId (should fetch all active)
    console.log('Executing auto_vote_strategy...');
    // Type casting because handler signatures vary in the array
    const result = await (action.handler as any)({});
    
    console.log('Execution Result:', JSON.stringify(result, null, 2));

  } catch (e) {
    console.error('Test Failed:', e);
  }
}

main();
