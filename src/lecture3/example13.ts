/**
 * Excel MCP Server (https://github.com/negokaz/excel-mcp-server) を使ったエージェントの例。
 */

import { Agent, MCPServerStdio, run } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const mcpServer = new MCPServerStdio({
  name: 'Excel MCP Server',
  fullCommand: 'npx --yes @negokaz/excel-mcp-server',
});
await mcpServer.connect();

try {
  const agent = new Agent({
    name: 'Excel Assistant',
    instructions: 'あなたはExcel操作を行うアシスタントです。ユーザーの指示に従って、Excelファイルを操作してください。',
    model: 'gpt-5-mini',
    mcpServers: [mcpServer],
  });
  await runAgent(
    agent,
    '架空の10人分の4科目のテストの点数を生成して、 `/Users/exkazuu/ghq/github.com/exKAZUu/intro-to-ai-agent-dev/src/lecture3/scores.xlsx` というファイルのScoresシートに保存して。'
  );
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
