/**
 * Excel MCP Server (https://github.com/negokaz/excel-mcp-server) を使ったエージェントの例。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, type ReactAgent } from 'langchain';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const execFileAsync = promisify(execFile);

const pythonSchema = z
  .object({
    code: z.string().describe('実行したいPythonコード。必要に応じてpandasなどをimportしてください。'),
  })
  .strict();

const pythonTool = new DynamicStructuredTool({
  name: 'python_calculator',
  description: '複雑な計算や表計算に必要な処理をPythonコードで実行します。結果はprintで標準出力に書き出してください。',
  schema: pythonSchema,
  func: async (input: z.output<typeof pythonSchema>) => {
    const { code } = input;
    try {
      const { stdout, stderr } = await execFileAsync('python3', ['-c', code], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        maxBuffer: 1024 * 1024,
      });
      if (stderr && stderr.trim().length > 0) {
        throw new Error(stderr.trim());
      }
      return stdout.trim();
    } catch (error) {
      if (error instanceof Error) {
        const stderr = (error as { stderr?: string }).stderr;
        const details = stderr?.trim().length ? stderr.trim() : error.message;
        throw new Error(`Python execution failed: ${details}`);
      }
      throw error;
    }
  },
});

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
  const tools = [...(await client.getTools()), pythonTool];
  const agent = createAgent({
    model: new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
    }),
    tools,
    systemPrompt:
      'あなたはExcel操作を行うアシスタントです。ユーザーの指示に従って、Excelファイルを操作してください。計算する際は、Pythonコードを生成してpython_calculatorツールを呼び出してください。',
  });
  await runAgent(
    agent,
    '`/Users/exkazuu/ghq/github.com/exKAZUu/intro-to-ai-agent-dev/src/lecture4/scores.xlsx` というファイルのScoresシートを読んで、各科目の平均点を計算して。'
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
