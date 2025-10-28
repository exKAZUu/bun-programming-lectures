/**
 * FindADomain MCP Server (https://findadomain.dev/mcp) を使ったエージェントの例。
 */

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, type ReactAgent } from 'langchain';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new MultiServerMCPClient({
  useStandardContentBlocks: true,
  mcpServers: {
    findadomain: {
      transport: 'http',
      url: 'https://api.findadomain.dev/mcp',
    },
  },
});

try {
  const tools = await client.getTools();
  const agent = createAgent({
    model: new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
    }),
    tools,
    systemPrompt:
      'あなたはドメイン名の空き状況を調べるアシスタントです。findadomain MCP サーバーのツールを使ってドメインの空き状況を確認し、結果を根拠とともに日本語でまとめてください。',
  });
  await runAgent(agent, '早稲田大学とAIに関連するドメイン名で、まだ取得されていないものを3つ教えてください。');
} finally {
  await client.close();
}

async function runAgent(agent: ReactAgent, prompt: string): Promise<void> {
  const result = await agent.invoke({
    messages: [{ role: 'user', content: prompt }],
  });

  const toolMessages = result.messages.filter((message): message is ToolMessage => message instanceof ToolMessage);

  if (toolMessages.length > 0) {
    console.log('\n=== ツール呼び出し結果 ===\n');
    const summaries = toolMessages.map((message) => {
      const summary: Record<string, unknown> = {
        toolCallId: message.tool_call_id,
        content: message.content,
      };
      if (message.artifact != null) {
        summary.artifact = message.artifact;
      }
      return summary;
    });
    console.dir(summaries, { depth: null });
  }

  let finalMessage: AIMessage | undefined;
  for (let index = result.messages.length - 1; index >= 0; index -= 1) {
    const message = result.messages[index];
    if (message instanceof AIMessage) {
      finalMessage = message;
      break;
    }
  }

  console.log('\n=== 最終結果 ===\n');
  if (finalMessage == null) {
    console.log('回答を生成できませんでした。');
    return;
  }

  if (typeof finalMessage.content === 'string') {
    console.log(finalMessage.content);
    return;
  }

  console.dir(finalMessage.content, { depth: null });
}
