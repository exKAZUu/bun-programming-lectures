/**
 * Tavilyツールを使って情報を検索するLangChainエージェントの例。
 * src/lecture2/example14.ts のAgents SDK版をLangChain構成に置き換えたもの。
 */

import { AIMessage, type BaseMessageLike, type ContentBlock, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';
process.env.TAVILY_API_KEY ||= 'tvly-<ここにTavilyのAPIキーを貼り付けてください>';

type ToolCallLog = {
  tool: string;
  input: unknown;
  output: unknown;
};

const tavilySearch = createTavilySearchTool();
const tools = [tavilySearch];
const toolMap = new Map(tools.map((tool) => [tool.name, tool] as const));

const llm = new ChatOpenAI({
  model: 'gpt-5-mini',
});

const modelWithTools = llm.bindTools(tools, {
  parallel_tool_calls: false,
  strict: true,
});

const question = prompt('調べたい質問を入力してください:')?.trim() ?? '';
if (!question) throw new Error('質問が入力されませんでした。');

const instruction = `
あなたはウェブ検索結果と大規模言語モデルを組み合わせて最新情報を回答する日本語のリサーチアシスタントです。
検索が必要な場合は必ず tavily_search ツールを呼び出し、得られた根拠URLを最終回答に記載してください。
最終回答では見出しや箇条書きなどを活用し、最後に参考URLを列挙してください。
`.trim();

const messages: BaseMessageLike[] = [
  ['system', instruction],
  ['human', question],
];

const steps: ToolCallLog[] = [];
let finalResponse: AIMessage | null = null;

for (let turn = 0; turn < 8; turn++) {
  const aiResponse = await modelWithTools.invoke(messages);
  if (!AIMessage.isInstance(aiResponse)) {
    throw new Error('LLMからAIメッセージ以外の応答が返ってきました。');
  }

  if (!aiResponse.tool_calls?.length) {
    finalResponse = aiResponse;
    break;
  }

  messages.push(aiResponse);

  for (const toolCall of aiResponse.tool_calls) {
    const tool = toolMap.get(toolCall.name);
    if (!tool) {
      const errorMessage = `ツール${toolCall.name}は登録されていません。`;
      steps.push({ tool: toolCall.name, input: toolCall.args, output: errorMessage });
      messages.push(
        new ToolMessage({
          content: errorMessage,
          tool_call_id: toolCall.id ?? `${turn}-${toolCall.name}`,
          status: 'error',
        })
      );
      continue;
    }

    const toolInvoker = tool as unknown as { invoke: (input: unknown) => Promise<unknown> };

    let toolOutput: unknown;
    try {
      toolOutput = await toolInvoker.invoke(toolCall);
    } catch (error) {
      toolOutput = { error: error instanceof Error ? error.message : 'tavily検索に失敗しました。' };
    }

    steps.push({ tool: toolCall.name, input: toolCall.args, output: toolOutput });

    const serializedOutput = typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput);
    messages.push(
      new ToolMessage({
        content: serializedOutput ?? '',
        tool_call_id: toolCall.id ?? `${turn}-${toolCall.name}`,
        status: 'success',
      })
    );
  }
}

printIntermediateSteps(steps);

console.log('\n=== 回答 ===\n');
if (finalResponse) {
  console.log(contentToText(finalResponse.content));
} else {
  console.log('回答を生成できませんでした。');
}

function createTavilySearchTool() {
  const tavilyClient = new TavilySearch({
    maxResults: 5,
    topic: 'general',
    includeAnswer: false,
    includeRawContent: false,
    includeImages: false,
    includeImageDescriptions: false,
  });

  const schema = z
    .object({
      query: z.string().min(1).describe('検索エンジンに投げる日本語または英語のクエリ'),
    })
    .strict();

  return new DynamicStructuredTool({
    name: tavilyClient.name,
    description: tavilyClient.description,
    schema,
    func: async (input) => {
      const { query } = schema.parse(input);
      return sanitizeTavilySearchOutput(await tavilyClient.invoke({ query }));
    },
  });
}

function printIntermediateSteps(steps: ToolCallLog[]) {
  if (!steps.length) return;

  console.log('\n=== 生成されたステップ ===\n');
  steps.forEach((step, index) => {
    const serializedInput = typeof step.input === 'string' ? step.input : JSON.stringify(step.input);
    const serializedOutput = typeof step.output === 'string' ? step.output : JSON.stringify(step.output);
    console.log(`[${index + 1}] tool=${step.tool}\n    input=${serializedInput}\n    output=${serializedOutput}\n`);
  });
}

function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block) => {
      switch (block.type) {
        case 'text': {
          const { text } = block as ContentBlock.Text;
          return text;
        }
        case 'reasoning': {
          const { reasoning } = block as ContentBlock.Reasoning;
          return `\n[Reasoning]\n${reasoning}\n[/Reasoning]\n`;
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('');
}

function sanitizeTavilySearchOutput(output: unknown) {
  if (!output || typeof output !== 'object') {
    return output;
  }

  const candidates = (output as { results?: unknown }).results;
  if (!Array.isArray(candidates)) {
    return output;
  }

  const results = candidates
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const { title, url, content } = item as {
        title?: unknown;
        url?: unknown;
        content?: unknown;
      };
      return {
        title: typeof title === 'string' ? title : '',
        url: typeof url === 'string' ? url : '',
        content: typeof content === 'string' ? content : '',
      };
    })
    .filter(Boolean);

  return { results };
}

// 例1: 2025年のノーベル平和賞は誰が受賞した？
// 例2: 2025年の自民党の総裁選挙の結果は？
