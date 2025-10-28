/**
 * 四則演算ツールとTavilyツールを組み合わせて情報検索の結果に基づいて計算するLangChainエージェントの例。
 * src/lecture2/example15.ts のAgents SDK版をLangChain構成に置き換えたもの。
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
const add = createBinaryOperationTool('add', '2つの数値を加算します', (term1, term2) => term1 + term2);
const sub = createBinaryOperationTool('sub', '2つの数値を減算します', (term1, term2) => term1 - term2);
const mul = createBinaryOperationTool('mul', '2つの数値を乗算します', (term1, term2) => term1 * term2);
const div = createBinaryOperationTool('div', '2つの数値を除算します', (term1, term2) => term1 / term2);

const tools = [tavilySearch, add, sub, mul, div];
const toolMap = new Map(tools.map((tool) => [tool.name, tool] as const));

const llm = new ChatOpenAI({
  model: 'gpt-4.1',
  temperature: 0,
});

const modelWithTools = llm.bindTools(tools, {
  parallel_tool_calls: false,
  strict: true,
});

const question =
  prompt('調べたい質問を入力してください（例: 日本で2番目に高い山と3番目に高い山の標高の合計値は？）:')?.trim() ?? '';
if (!question) throw new Error('質問が入力されませんでした。');

const instruction = `
あなたはウェブ検索と計算用のツールを使い分けて数値的な問いに答える日本語のリサーチアシスタントです。
検索が必要な場合は必ず tavily_search を使用し、必要な合計や差分などの計算は提供された算術ツールで実行してください。
最終回答では根拠URLと計算内容を日本語で端的に示してください。
`.trim();

const messages: BaseMessageLike[] = [
  ['system', instruction],
  ['human', question],
];

const steps: ToolCallLog[] = [];
let finalResponse: AIMessage | null = null;

for (let turn = 0; turn < 10; turn++) {
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

    if (tool instanceof TavilySearch) {
      console.log('\n[tool] tavily_search');
      console.log(`[tool] input: ${JSON.stringify(toolCall.args)}`);
    }

    let toolOutput: unknown;
    try {
      toolOutput = await toolInvoker.invoke(toolCall);
    } catch (error) {
      toolOutput = { error: error instanceof Error ? error.message : 'tavily検索に失敗しました。' };
    }

    if (tool instanceof TavilySearch) {
      toolOutput = sanitizeTavilySearchOutput(toolOutput);
      console.log('[tool] output:', JSON.stringify(toolOutput, null, 2));
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

console.log('\n=== 計算結果 ===\n');
if (finalResponse) {
  console.log(contentToText(finalResponse.content));
} else {
  console.log('回答を生成できませんでした。');
}

function createTavilySearchTool(): TavilySearch {
  return new TavilySearch({
    name: 'tavily_search',
    description: '最新のウェブ検索結果から山の標高などの事実を調べます。',
    maxResults: 5,
    topic: 'general',
    includeAnswer: false,
    includeRawContent: false,
    includeImages: false,
    includeImageDescriptions: false,
  });
}

function createBinaryOperationTool(
  name: string,
  description: string,
  operation: (term1: number, term2: number) => number
) {
  return new DynamicStructuredTool({
    name,
    description,
    schema: z
      .object({
        term1: z.number().describe('演算で扱う1つ目の数値'),
        term2: z.number().describe('演算で扱う2つ目の数値'),
      })
      .strict(),
    func: async ({ term1, term2 }) => {
      console.log(`\n[tool] ${name}`);
      console.log(`[tool] input: ${JSON.stringify({ term1, term2 })}`);

      const result = operation(term1, term2);
      // 非有限の値が返るとモデルが誤った説明を生成しやすいため拒否する。
      if (!Number.isFinite(result)) {
        throw new Error('計算結果が有限の数値ではありません。');
      }

      const serialized = { result };
      console.log('[tool] output:', JSON.stringify(serialized, null, 2));
      return serialized;
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

// 例1: 日本で5番目に高い山と世界で5番目に高い山の標高を乗じた結果は？ ->
//      3,180 × 8,463 = 26,912,340m or
//      3,180 × 8,465 = 26,982,300m or
//      3,180 × 8,481 = 26,969,580m or
//      3,180 × 8,485 = 26,982,300m
//      （Webサイトによってマカルーの標高の記載が異なる）
// 例2: 日本で6番目に高い山の標高から2025年の自民党の総裁選挙の決選投票における高市早苗氏の得票数を引いた結果は？ -> 3141－185＝2956
