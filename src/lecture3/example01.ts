/**
 * メモリ上で会話履歴を管理するエージェントの例 (固定入力)
 */

import type { AgentInputItem } from '@openai/agents';
import { Agent, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

let thread: AgentInputItem[] = [];

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

async function userSays(text: string) {
  console.dir(thread, { depth: null });
  const result = await run(agent, thread.concat({ role: 'user', content: text }));

  thread = result.history;
  return result.finalOutput;
}

const ret1 = await userSays('日本の地理的な中心に位置する都道府県を一つ挙げてください。');
console.log(ret1);

const ret2 = await userSays('その南にある都道府県は？');
console.log(ret2);
