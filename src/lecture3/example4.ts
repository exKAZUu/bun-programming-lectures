import { Agent, MCPServerStdio, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

async function main() {
  // 事前に `bun playwright install chromium` を実行しておくこと
  const mcpServer = new MCPServerStdio({
    name: 'Playwright MCP Server',
    fullCommand: `npx --yes @playwright/mcp@latest`,
  });
  await mcpServer.connect();
  try {
    const agent = new Agent({
      name: 'Browser Assistant',
      instructions:
        'あなたはブラウザ操作を行うアシスタントです。ユーザーの指示に従って、ウェブページを操作してください。',
      mcpServers: [mcpServer],
    });
    const result = await run(agent, '今日の東京の天気を調べて。');
    console.log(result.finalOutput);
  } finally {
    await mcpServer.close();
  }
}

main().catch(console.error);
