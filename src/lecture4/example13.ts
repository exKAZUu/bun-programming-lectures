/**
 * Excel MCP Server (https://github.com/negokaz/excel-mcp-server) を使ったエージェントの例。
 */

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, type ReactAgent } from 'langchain';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new MultiServerMCPClient({
  useStandardContentBlocks: true,
  mcpServers: {
    excel: {
      transport: 'stdio',
      command: 'npx',
      args: ['--yes', '@negokaz/excel-mcp-server'],
    },
  },
});

try {
  const tools = await client.getTools();
  const agent = createAgent({
    model: new ChatOpenAI({
      model: 'gpt-5-mini',
    }),
    tools,
    systemPrompt: 'あなたはExcel操作を行うアシスタントです。ユーザーの指示に従って、Excelファイルを操作してください。',
  });
  await runAgent(
    agent,
    '架空の10人分の4科目のテストの点数を生成して、 `/Users/exkazuu/ghq/github.com/exKAZUu/intro-to-ai-agent-dev/src/lecture4/scores.xlsx` というファイルのScoresシートに保存して。'
  );
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
