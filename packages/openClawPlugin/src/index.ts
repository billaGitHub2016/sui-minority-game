import { MinorityGameService } from './service';
import { MinorityGameStrategy } from './strategy';

const POLL_DURATION = 3600 * 1000 // 60 minutes

export const minorityGameSkill = {
  name: 'openclaw-minority-game-plugin',
  description: 'Participate in the Sui Minority Game: vote on polls, try to be in the minority. This plugin allows you to view active polls, analyze them using AI strategies, and vote on them.',
  actions: [
    {
      name: 'commit_vote',
      description: 'Commit a vote for a specific poll',
      parameters: {
        type: 'object',
        properties: {
          pollId: { type: 'string', description: 'The On-Chain Object ID of the Poll' },
          choice: { type: 'string', description: 'The choice: "A" or "B"' },
          salt: { type: 'string', description: 'A random 16-byte hex string for salt' },
        },
        required: ['pollId', 'choice', 'salt'],
      },
      handler: async ({ pollId, choice, salt }: { pollId: string; choice: string; salt: string }) => {
        const service = new MinorityGameService();
        const result = await service.commitVote(pollId, choice, salt);
        return result;
      },
    },
    {
      name: 'get_active_polls',
      description: 'Retrieve a list of currently active polls/topics/games from the Sui Minority Game. Use this to find out what users are voting on.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const service = new MinorityGameService();
        const polls = await service.fetchActivePolls();
        return polls;
      },
    },
    {
      name: 'analyze_poll',
      description: 'Analyze a poll using AI strategy to predict the minority choice',
      parameters: {
        type: 'object',
        properties: {
          pollId: { type: 'string', description: 'The On-Chain Object ID of the Poll' },
          title: { type: 'string', description: 'Poll Title' },
          description: { type: 'string', description: 'Poll Description' },
          option_a: { type: 'string', description: 'Option A Text' },
          option_b: { type: 'string', description: 'Option B Text' },
        },
        required: ['pollId', 'title', 'option_a', 'option_b'],
      },
      handler: async (poll: any) => {
        const strategy = new MinorityGameStrategy();
        // Construct a poll object compatible with strategy
        const pollObj = {
          on_chain_id: poll.pollId,
          title: poll.title,
          description: poll.description,
          option_a: poll.option_a,
          option_b: poll.option_b
        };
        const analysis = await strategy.predictMinority(pollObj);
        return analysis;
      },
    },
    {
      name: 'auto_vote_strategy',
      description: 'Automatically analyze active polls using AI strategy and vote on them',
      parameters: {
        type: 'object',
        properties: {
          pollId: { type: 'string', description: 'Optional: Specific Poll ID to vote on. If omitted, votes on all active polls.' }
        },
      },
      handler: async ({ pollId }: { pollId?: string }) => {
        const service = new MinorityGameService();
        const strategy = new MinorityGameStrategy();
        
        // 1. Fetch polls
        let polls = await service.fetchActivePolls();
        
        if (pollId) {
          polls = polls.filter(p => p.on_chain_id === pollId);
        }

        if (polls.length === 0) {
          return { status: 'no_active_polls', message: 'No active polls found to vote on.' };
        }

        const results = [];

        // 2. Process each poll
        for (const poll of polls) {
          try {
            // A. Analyze
            const analysis = await strategy.predictMinority(poll);
            console.log(`[Strategy] Poll ${poll.on_chain_id}: Chose ${analysis.choice} because: ${analysis.reason}`);
            
            // B. Generate Salt
            const salt = service.generateSalt();
            
            // C. Vote
            // Pass the database UUID for backup
            const voteResult = await service.commitVote(poll.on_chain_id, analysis.choice, salt, poll.id, poll.created_at + POLL_DURATION); 
            
            results.push({
              pollId: poll.on_chain_id,
              choice: analysis.choice,
              reason: analysis.reason,
              voteResult
            });
          } catch (error: any) {
            console.error(`[Strategy] Error processing poll ${poll.on_chain_id}:`, error);
            results.push({
              pollId: poll.on_chain_id,
              error: error.message
            });
          }
        }

        return {
          status: 'completed',
          results
        };
      },
    },
  ],
};

// Register plugin for OpenClaw
export default function register(api: any, pluginConfig?: any) {
  // Merge config from OpenClaw with defaults
  const configOverrides = {
    privateKey: pluginConfig?.privateKey || pluginConfig?.suiPrivateKey,
    network: pluginConfig?.network || pluginConfig?.suiNetwork,
    fullnodeUrl: pluginConfig?.fullnodeUrl || pluginConfig?.suiFullnodeUrl,
    packageId: pluginConfig?.packageId || pluginConfig?.suiPackageId,
    apiUrl: pluginConfig?.apiUrl,
    openai: pluginConfig?.openai,
  };

  // Register each action from the minority game skill as an agent tool
  for (const action of minorityGameSkill.actions) {
    api.registerTool(
      {
        name: action.name,
        description: action.description,
        parameters: action.parameters,
        async execute(_id: string, params: any) {
          try {
            // Pass configuration to the handler via a modified action handler wrapper
            // or modify the handler to accept config.
            // Since handlers are defined statically above, we need to inject config here.
            
            // Re-instantiate service with config inside the handler context if possible, 
            // but the handler is defined in the object above.
            // Let's modify how we call the handler.
            
            // We need to pass the config to the service. 
            // The cleanest way is to pass configOverrides to the handler function.
            // But the handler signature is fixed.
            
            // Workaround: We can't easily change the static handler signature.
            // Instead, we can instantiate the service HERE in the execute function
            // and pass it to a modified handler, OR
            // we can refactor the handlers to be created inside this register function.
            
            // Let's refactor the handlers to use a service factory or similar.
            // For now, let's just manually instantiate the service and call methods directly here?
            // No, that duplicates logic.
            
            // Better: Update the 'minorityGameSkill' object to be a factory function or class?
            // Or simpler: Assign the config to a global/module-level variable that the service can read?
            // No, that's not safe for concurrency/multiple instances.
            
            // Best: Modify the actions to accept a service instance or config.
            // But 'minorityGameSkill' is exported as a constant object.
            
            // Let's intercept the handler call.
            // We can replace the handler implementation in the loop? No.
            
            // Let's modify the 'execute' function to inject config into the service.
            // Since we can't change 'MinorityGameService' inside 'minorityGameSkill.actions',
            // we should probably redefine 'minorityGameSkill' or how it's used.
            
            // Actually, the simplest way for this specific codebase:
            // The handlers in 'minorityGameSkill.actions' instantiate 'new MinorityGameService()'.
            // We can change 'MinorityGameService' to accept config.
            // But we can't pass it from here easily without changing the handler signature.
            
            // Let's update 'minorityGameSkill' to have a 'configure' method or similar?
            
            // Or simpler: Just rely on process.env for now if we can't easily change the architecture.
            // But the user wants to know how to configure it.
            
            // Let's try to set process.env from the pluginConfig if provided!
            // This is a hack but works for "environment variables".
            if (configOverrides.privateKey) process.env.SUI_PRIVATE_KEY = configOverrides.privateKey;
            if (configOverrides.network) process.env.SUI_NETWORK = configOverrides.network;
            if (configOverrides.fullnodeUrl) process.env.SUI_FULLNODE_URL = configOverrides.fullnodeUrl;
            if (configOverrides.packageId) process.env.SUI_PACKAGE_ID = configOverrides.packageId;
            if (configOverrides.apiUrl) process.env.NEXT_PUBLIC_API_URL = configOverrides.apiUrl;
            if (configOverrides.openai?.apiKey) process.env.OPENAI_API_KEY = configOverrides.openai.apiKey;
            if (configOverrides.openai?.baseUrl) process.env.OPENAI_BASE_URL = configOverrides.openai.baseUrl;

            const result = await action.handler(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: error.message || String(error) },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      },
      { optional: true } // Make tools opt-in for safety
    );
  }

  // Register a simple status RPC method
  api.registerGatewayMethod('minorityGame.status', ({ respond }: any) => {
    respond(true, { ok: true, status: 'Minority Game plugin loaded' });
  });
}

// If running directly (not as a library), we can execute a CLI or simple runner
if (require.main === module) {
  console.log("Minority Game Skill Loaded.");
}
