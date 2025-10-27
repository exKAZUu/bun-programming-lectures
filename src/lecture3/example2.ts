import type { AgentInputItem } from '@openai/agents';
import { Agent, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

let thread: AgentInputItem[] = [];

for (let i = 0; i < 3; i++) {
  const userMessage = prompt(`AIへの入力 ${i + 1}/3:`);
  if (!userMessage) continue;

  const assistantMessage = await continueConversation(userMessage);
  console.dir(thread, { depth: null });
  console.log('Output:', assistantMessage, '\n');
}

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？

async function continueConversation(text: string) {
  const result = await run(agent, thread.concat({ role: 'user', content: text }));

  thread = result.history;
  return result.finalOutput;
}
