import type { AgentInputItem } from '@openai/agents';
import { Agent, run } from '@openai/agents';

let thread: AgentInputItem[] = [];

const agent = new Agent({
  name: 'Assistant',
  model: 'gpt-5-nano',
});

async function userSays(text: string) {
  const result = await run(agent, thread.concat({ role: 'user', content: text }));

  thread = result.history;
  return result.finalOutput;
}

const ret1 = await userSays('日本の地理的な中心にある都道府県を一つ挙げてください。');
console.log(ret1);

const ret2 = await userSays('その南にある都道府県は？');
console.log(ret2);
