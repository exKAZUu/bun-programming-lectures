/**
 * Playwright MCP Server (https://github.com/microsoft/playwright-mcp) を使ったエージェントの例。
 */

import { Agent, MCPServerStdio, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

// 事前に `npx --yes playwright install chromium` を実行しておくこと
const mcpServer = new MCPServerStdio({
  name: 'Playwright MCP Server',
  fullCommand: 'npx --yes @playwright/mcp@latest',
});
await mcpServer.connect();
const agent = new Agent({
  name: 'Browser Assistant',
  instructions: 'あなたはブラウザ操作を行うアシスタントです。ユーザーの指示に従って、ウェブページを操作してください。',
  model: 'gpt-5',
  mcpServers: [mcpServer],
});
await runAgent(agent, '新宿駅の周辺にある焼肉屋で明日19時から4名で予約できるお店を探して、予約画面を表示して。');

async function runAgent(agent: Agent, prompt: string): Promise<void> {
  const response = await run(agent, prompt);

  if (response.newItems.length > 0) {
    console.log('\n=== 生成されたアイテム ===\n');
    console.dir(
      response.newItems.map((item) => item.toJSON()),
      { depth: null }
    );
  }

  const finalOutput = response.finalOutput;
  console.log('\n=== 最終結果 ===\n');
  if (typeof finalOutput === 'string') {
    console.log(finalOutput);
  } else if (finalOutput != null) {
    console.log(JSON.stringify(finalOutput));
  } else {
    console.log('回答を生成できませんでした。');
  }
}
