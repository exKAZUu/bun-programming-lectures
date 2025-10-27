/**
 * conversationId を使って OpenAIのサーバー上で会話履歴を管理するエージェントの例 (自由入力)
 */

import { Agent, run } from '@openai/agents';
import { OpenAI } from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

const client = new OpenAI();
const { id: conversationId } = await client.conversations.create({});
console.log('conversationId:', conversationId);

for (let i = 0; i < 3; i++) {
  const userMessage = prompt(`AIへの入力 ${i + 1}/3:`);
  if (!userMessage) continue;

  const response = await run(agent, userMessage, { conversationId });
  const assistantMessage = response.finalOutput;
  console.log('Output:', assistantMessage, '\n');
}

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？
