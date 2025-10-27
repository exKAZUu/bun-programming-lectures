/**
 * previousResponseId を使って OpenAIのサーバー上で会話履歴を管理するエージェントの例 (自由入力)
 */

import { Agent, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

let previousResponseId: string | undefined;

for (let i = 0; i < 3; i++) {
  const userMessage = prompt(`AIへの入力 ${i + 1}/3:`);
  if (!userMessage) continue;

  const response = await continueConversation(userMessage, previousResponseId);
  console.log('Output:', response.finalOutput);

  if (response.lastResponseId) {
    console.log('previousResponseId:', response.lastResponseId);
  }

  previousResponseId = response.lastResponseId;
  console.log();
}

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？

async function continueConversation(text: string, previousResponseId?: string) {
  const options = previousResponseId ? { previousResponseId } : undefined;
  return run(agent, text, options);
}
