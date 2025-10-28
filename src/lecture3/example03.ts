/**
 * conversationId を使って OpenAIのサーバー上で会話履歴を管理するエージェントの例 (固定入力)
 */

import { Agent, run } from '@openai/agents';
import { OpenAI } from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

// Create a server-managed conversation:
const client = new OpenAI();
const { id: conversationId } = await client.conversations.create({});
console.log('conversationId:', conversationId);

const first = await run(agent, '日本の地理的な中心に位置する都道府県を一つ挙げてください。', {
  conversationId,
});
console.log(first.finalOutput);

const second = await run(agent, 'その南にある都道府県は？', { conversationId });
console.log(second.finalOutput);
