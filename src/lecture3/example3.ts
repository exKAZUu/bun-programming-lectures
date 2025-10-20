import { Agent, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Assistant',
  instructions: '簡潔に回答してください。',
  model: 'gpt-5-nano',
});

async function main() {
  const first = await run(agent, '日本の地理的な中心の都道府県を一つ挙げてください。');
  console.log(first.finalOutput);

  const previousResponseId = first.lastResponseId;
  console.log('previousResponseId:', previousResponseId);

  const second = await run(agent, 'その南にある都道府県は？', {
    previousResponseId,
  });
  console.log(second.finalOutput);
}

main().catch(console.error);
