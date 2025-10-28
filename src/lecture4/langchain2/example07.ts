/**
 * 四則演算ツールを使って数式を計算するエージェントの例。
 * src/lecture2/example12.ts のAgents SDK版。
 */

import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const add = createBinaryOperationTool('add', '2つの数値を加算します', (term1, term2) => term1 + term2);
const sub = createBinaryOperationTool('sub', '2つの数値を減算します', (term1, term2) => term1 - term2);
const mul = createBinaryOperationTool('mul', '2つの数値を乗算します', (term1, term2) => term1 * term2);
const div = createBinaryOperationTool('div', '2つの数値を除算します', (term1, term2) => term1 / term2);

function createBinaryOperationTool(
  name: string,
  description: string,
  operation: (term1: number, term2: number) => number
) {
  return tool({
    name,
    description,
    parameters: z
      .object({
        term1: z.number().describe('演算で扱う1つ目の数値'),
        term2: z.number().describe('演算で扱う2つ目の数値'),
      })
      .strict(),
    strict: true,
    async execute({ term1, term2 }) {
      const result = operation(term1, term2);
      // 無効な値を返すとエージェントの推論が崩れるため、有限値のみ許可する。
      if (!Number.isFinite(result)) {
        throw new Error('計算結果が有限の数値ではありません。');
      }
      return { result };
    },
  });
}

const agent = new Agent({
  name: 'Calculator',
  instructions: `
あなたはユーザが入力した数式の計算結果を出力するAIです。
演算子の優先順位を考慮して、提供されている関数ツールを使って少しずつ計算してください。
全ての計算が終わったら、最終的な計算結果の数値だけを出力してください。
各ツールは result フィールドに計算結果を返します。
`.trim(),
  model: 'gpt-5-mini',
  tools: [add, sub, mul, div],
});

const userMessage = prompt(`数式を入力してください:`);
if (!userMessage) throw new Error('数式が入力されませんでした。');

const response = await run(agent, userMessage, { maxTurns: 10 });

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
  console.log('結果を生成できませんでした。');
}

// 例1: 5178952 + 25198791 -> 30377743
// 例2: 3 + 5 * 2 - 4 -> 9
// 例3: (10 - 2) * (3 + 4) / 2 -> 28
