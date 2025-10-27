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
      'あなたはドメイン名の空き状況を調べるアシスタントです。回答する前に必ず findadomain MCP サーバーのツールを使ってドメインの空き状況を確認し、結果を根拠とともに日本語でまとめてください。',
    mcpServers: [mcpServer],
  });
  await runAgent(
    agent,
    [
      '新しい AI プロダクト「sakura ai labs」に合うドメインを探しています。',
      'ドメイン名は `sakuraailabs` とし、次の TLD について `check_domain` ツールで空き状況を調べてください: com, net, ai, dev。',
      'ツールの結果を表形式でまとめ、利用できるドメインがあればおすすめの理由を最後に一言添えてください。',
    ].join('\n')
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
