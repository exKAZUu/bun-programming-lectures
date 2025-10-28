/**
 * Responses APIのfunction callでTavily検索と四則演算ツールを同時に扱い、検索結果に基づく計算を行う総合例。
 */

import { tavily } from '@tavily/core';
import OpenAI from 'openai';
import type { ResponseFunctionToolCall } from 'openai/resources/responses/responses';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';
process.env.TAVILY_API_KEY ||= 'tvly-<ここにTavilyのAPIキーを貼り付けてください>';

const client = new OpenAI();
const tvly = tavily();

const tools: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'tavily_search',
    description: '最新のウェブ検索結果から山の標高などの事実を調べます。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索する日本語もしくは英語のクエリ',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'add',
    description: '2つの数値を加算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '加算する1つ目の数値' },
        term2: { type: 'number', description: '加算する2つ目の数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'sub',
    description: '2つの数値を減算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '減算される数値' },
        term2: { type: 'number', description: '減算する数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'mul',
    description: '2つの数値を乗算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '乗算する1つ目の数値' },
        term2: { type: 'number', description: '乗算する2つ目の数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'div',
    description: '2つの数値を除算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '除算される数値' },
        term2: { type: 'number', description: '除算する数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const question =
  prompt(`調べたい質問を入力してください（例: 日本で2番目に高い山と3番目に高い山の標高の合計値は？）:`)?.trim() ?? '';
if (!question) throw new Error('質問が入力されませんでした。');

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはウェブ検索と計算用の関数ツールを使い分けて数値的な問いに答える日本語のリサーチアシスタントです。
検索が必要な場合は必ずtavily_searchを使用し、必要な合計や差分などの計算は提供された算術ツールで行ってください。
最終回答では根拠URLと計算内容を日本語で端的に示してください。
`.trim(),
  },
  {
    role: 'user',
    content: question,
  },
];

let finalText = '';
for (let turn = 0; turn < 8; turn++) {
  const response = await client.responses.create({
    model: 'gpt-4.1',
    tools,
    input,
  });

  let madeToolCall = false;
  for (const item of response.output) {
    if (item.type === 'function_call') {
      madeToolCall = true;
      input.push(item);
      logToolRequest(item);

      const callResult = await dispatchToolCall(item as FunctionCallItem);
      logToolResponse(item, callResult);
      input.push({
        type: 'function_call_output',
        call_id: item.call_id,
        output: JSON.stringify(callResult),
      });
    }
  }

  if (!madeToolCall) {
    finalText = response.output_text ?? '';
    break;
  }
}

console.log('\n=== 計算結果 ===\n');
console.log(finalText || '回答を生成できませんでした。');

type FunctionCallItem = ResponseFunctionToolCall;

async function dispatchToolCall(call: FunctionCallItem) {
  if (call.type !== 'function_call') {
    return { error: '未対応のツール種別です。' };
  }

  if (call.name === 'tavily_search') {
    return await executeTavilySearch(parseTavilyArgs(call.arguments));
  }

  const numericArgs = parseArithmeticArgs(call.arguments);
  const result = calculate(call.name, numericArgs);
  return Number.isFinite(result) ? { result } : { error: '算術ツールでエラーが発生しました。' };
}

function logToolRequest(call: ResponseFunctionToolCall) {
  console.log('\n[tool] モデルがツール呼び出しを要求しました');
  console.log(`[tool] name: ${call.name}`);
  console.log(`[tool] raw arguments: ${call.arguments}`);
}

function logToolResponse(call: ResponseFunctionToolCall, callResult: unknown) {
  console.log('[tool] 実装側のレスポンス:', JSON.stringify(callResult, null, 2));
  console.log(`[tool] call_id: ${call.call_id}`);
}

function parseTavilyArgs(rawArguments: string | null | undefined): { query: string } {
  if (!rawArguments) throw new Error('tavily_searchの引数が空です。');

  const parsed = JSON.parse(rawArguments) as { query?: unknown };
  if (typeof parsed.query !== 'string' || !parsed.query.trim()) {
    throw new Error('検索クエリを解析できませんでした。');
  }

  return { query: parsed.query };
}

function parseArithmeticArgs(rawArguments: string | null | undefined): [number, number] {
  if (!rawArguments) throw new Error('算術ツールの引数が空です。');

  const parsed = JSON.parse(rawArguments) as { term1?: unknown; term2?: unknown };
  if (typeof parsed.term1 !== 'number' || typeof parsed.term2 !== 'number') {
    throw new Error('算術ツールの引数が数値ではありません。');
  }

  return [parsed.term1, parsed.term2];
}

function calculate(func: string, parameters: [number, number]): number {
  const [term1, term2] = parameters;
  switch (func) {
    case 'add':
      return term1 + term2;
    case 'sub':
      return term1 - term2;
    case 'mul':
      return term1 * term2;
    case 'div':
      return term1 / term2;
    default:
      return NaN;
  }
}

async function executeTavilySearch({ query }: { query: string }) {
  try {
    const { results } = await tvly.search(query, {
      includeAnswer: false,
      includeImages: false,
      maxResults: 5,
    });

    // 出典をそのまま渡すことで、LLMが根拠を明示できるようにする。
    return {
      results: results.map((item) => ({
        title: item.title,
        url: item.url,
        content: item.content,
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'tavily検索に失敗しました。' };
  }
}

// 例1: 日本で5番目に高い山と世界で5番目に高い山の標高を乗じた結果は？ ->
//      3,180 × 8,463 = 26,912,340m or
//      3,180 × 8,465 = 26,982,300m or
//      3,180 × 8,481 = 26,969,580m or
//      3,180 × 8,485 = 26,982,300m
//      （Webサイトによってマカルーの標高の記載が異なる）
// 例2: 日本で6番目に高い山の標高から2025年の自民党の総裁選挙の決選投票における高市早苗氏の得票数を引いた結果は？ -> 3141－185＝2956

// `bun run src/lecture1/example07.ts` の応答と比較してみよう！
