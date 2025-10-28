/**
 * FindADomain MCP Server (https://findadomain.dev/mcp) を使ったエージェントの例。
 */

import { Agent, MCPServerStreamableHttp, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const mcpServer = new MCPServerStreamableHttp({
  name: 'Find a Domain MCP Server',
  url: 'https://api.findadomain.dev/mcp',
});
await mcpServer.connect();

try {
  const agent = new Agent({
    name: 'Domain Assistant',
    instructions:
      'あなたはドメイン名の空き状況を調べるアシスタントです。findadomain MCP サーバーのツールを使ってドメインの空き状況を確認し、結果を根拠とともに日本語でまとめてください。',
    model: 'gpt-5-mini',
    mcpServers: [mcpServer],
  });
  await runAgent(agent, '早稲田大学とAIに関連するドメイン名で、まだ取得されていないものを3つ教えてください。');
} finally {
  await mcpServer.close();
}

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
