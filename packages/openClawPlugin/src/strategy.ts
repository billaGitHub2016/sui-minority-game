import { getConfig } from './config';

export interface StrategyResult {
  pollId: string;
  choice: string; // "A" or "B" (or specific option text if supported)
  reason: string;
}

export class MinorityGameStrategy {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.openai.apiKey;
    this.baseUrl = config.openai.baseUrl;
  }

  /**
   * Predicts the MINORITY choice for a given poll.
   * Strategy: Ask LLM what the majority would choose, then pick the opposite.
   */
  async predictMinority(poll: any): Promise<StrategyResult> {
    const { on_chain_id, title, option_a, option_b, description } = poll;

    if (!this.apiKey) {
      console.warn("No OpenAI API Key found. Falling back to Random Strategy.");
      return this.randomStrategy(poll);
    }

    try {
      const prompt = `
You are a master strategist playing the "Minority Game". 
Your goal is to be in the MINORITY group.
To win, you must predict what the MAJORITY of people will choose, and then choose the OPPOSITE.

Topic: "${title}"
Description: "${description || ''}"
Option A: "${option_a}"
Option B: "${option_b}"

Task:
1. Analyze the psychological bias of the general public.
2. Predict which option the MAJORITY will likely pick.
3. Your choice must be the OTHER option (the Minority).

Output JSON only:
{
  "majority_choice": "Option A or Option B",
  "minority_choice": "Option A or Option B",
  "reason": "Short explanation of why majority picks X"
}
`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-v3-aliyun",
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse JSON from content (handle potential markdown blocks)
      const jsonStr = content.replace(/```json\n|\n```/g, '').trim();
      const result = JSON.parse(jsonStr);

      const choice = result.minority_choice.includes("Option A") ? option_a : option_b;

      return {
        pollId: on_chain_id,
        choice: choice, // A or B
        reason: `AI Strategy: Majority likely picks ${result.majority_choice} because "${result.reason}". So we pick ${choice}.`
      };

    } catch (e) {
      console.error("Strategy execution failed:", e);
      return this.randomStrategy(poll);
    }
  }

  private randomStrategy(poll: any): StrategyResult {
    const choice = Math.random() > 0.5 ? poll.option_a : poll.option_b;
    return {
      pollId: poll.on_chain_id,
      choice,
      reason: "Random Strategy (Fallback)"
    };
  }
}
