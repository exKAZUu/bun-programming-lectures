/**
 * 四則演算ツールを使って数式を計算するLangChainエージェントの例。
 * src/lecture2/example12.ts のAgents SDK版をLangChain相当の構成に書き換えたもの。
 */

import {
  AIMessage,
  type BaseMessageLike,
  type ContentBlock,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

type ToolCallLog = {
  tool: string;
  input: unknown;
  output: unknown;
};

const add = createBinaryOperationTool('add', '2つの数値を加算します', (term1, term2) => term1 + term2);
const sub = createBinaryOperationTool('sub', '2つの数値を減算します', (term1, term2) => term1 - term2);
const mul = createBinaryOperationTool('mul', '2つの数値を乗算します', (term1, term2) => term1 * term2);
const div = createBinaryOperationTool('div', '2つの数値を除算します', (term1, term2) => term1 / term2);

const tools = [add, sub, mul, div];
const toolMap = new Map(tools.map((tool) => [tool.name, tool] as const));

const llm = new ChatOpenAI({
  model: 'gpt-5-mini',
});

const modelWithTools = llm.bindTools(tools, {
  parallel_tool_calls: false,
  strict: true,
});

const userMessage = prompt('数式を入力してください:')?.trim() ?? '';
if (!userMessage) throw new Error('数式が入力されませんでした。');

const instruction = `
あなたはユーザが入力した数式の計算結果を出力するAIです。
演算子の優先順位を考慮しつつ、提供されている算術ツールを段階的に呼び出してください。
最終的な回答では計算結果のみを数値で出力してください。
各ツールは result フィールドに計算結果を返します。
`.trim();

const messages: BaseMessageLike[] = [
  new SystemMessage({ content: instruction }),
  new HumanMessage({ content: userMessage }),
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

    const toolOutput = await tool.invoke(toolCall);
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

console.log('\n=== 最終結果 ===\n');
if (finalResponse) {
  console.log(contentToText(finalResponse.content));
} else {
  console.log('結果を生成できませんでした。');
}

function createBinaryOperationTool(
  name: string,
  description: string,
  operation: (term1: number, term2: number) => number
) {
  const schema = z
    .object({
      term1: z.number().describe('演算で扱う1つ目の数値'),
      term2: z.number().describe('演算で扱う2つ目の数値'),
    })
    .strict();

  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input) => {
      const { term1, term2 } = schema.parse(input);
      const result = operation(term1, term2);
      // LLMが不正な値を取り扱うと推論が破綻するため、有限値のみを返す。
      if (!Number.isFinite(result)) {
        throw new Error('計算結果が有限の数値ではありません。');
      }
      return { result };
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

// 例1: 5178952 + 25198791 -> 30377743
// 例2: 3 + 5 * 2 - 4 -> 9
// 例3: (10 - 2) * (3 + 4) / 2 -> 28
