import { Agent, run, tool } from '@openai/agents';
import { tavily } from '@tavily/core';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';
process.env.TAVILY_API_KEY ||= 'tvly-<ここにTavilyのAPIキーを貼り付けてください>';

const tvly = tavily();
const tavilySearch = createTavilySearchTool();
const add = createBinaryOperationTool('add', '2つの数値を加算します', (term1, term2) => term1 + term2);
const sub = createBinaryOperationTool('sub', '2つの数値を減算します', (term1, term2) => term1 - term2);
const mul = createBinaryOperationTool('mul', '2つの数値を乗算します', (term1, term2) => term1 * term2);
const div = createBinaryOperationTool('div', '2つの数値を除算します', (term1, term2) => term1 / term2);

const agent = new Agent({
  name: 'Hybrid researcher',
  instructions: `
あなたはウェブ検索と計算用の関数ツールを使い分けて数値的な問いに答える日本語のリサーチアシスタントです。
検索が必要な場合は必ずtavily_searchを使用し、必要な合計や差分などの計算は提供された算術ツールで行ってください。
最終回答では根拠URLと計算内容を日本語で端的に示してください。
`.trim(),
  model: 'gpt-4.1',
  modelSettings: {
    temperature: 0,
  },
  tools: [tavilySearch, add, sub, mul, div],
});

const question =
  prompt(`調べたい質問を入力してください（例: 日本で2番目に高い山と3番目に高い山の標高の合計値は？）:`)?.trim() ?? '';
if (!question) throw new Error('質問が入力されませんでした。');

const response = await run(agent, question, { maxTurns: 8 });

if (response.newItems.length > 0) {
  console.log('\n=== 生成されたアイテム ===\n');
  console.dir(
    response.newItems.map((item) => item.toJSON()),
    { depth: null }
  );
}

const finalOutput = response.finalOutput;
console.log('\n=== 計算結果 ===\n');
if (typeof finalOutput === 'string') {
  console.log(finalOutput);
} else if (finalOutput != null) {
  console.log(JSON.stringify(finalOutput));
} else {
  console.log('回答を生成できませんでした。');
}

function createTavilySearchTool() {
  return tool({
    name: 'tavily_search',
    description: '最新のウェブ検索結果から山の標高などの事実を調べます。',
    parameters: z
      .object({
        query: z.string().min(1).describe('検索する日本語もしくは英語のクエリ'),
      })
      .strict(),
    strict: true,
    async execute({ query }, _context, details) {
      const callId = details?.toolCall.callId ?? 'unknown';
      console.log(`\n[tool] tavily_search callId=${callId}`);
      console.log(`[tool] arguments: ${JSON.stringify({ query })}`);

      const result = await executeTavilySearch(query);
      console.log('[tool] response:', JSON.stringify(result, null, 2));
      return result;
    },
  });
}

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
    async execute({ term1, term2 }, _context, details) {
      const callId = details?.toolCall.callId ?? 'unknown';
      console.log(`\n[tool] ${name} callId=${callId}`);
      console.log(`[tool] arguments: ${JSON.stringify({ term1, term2 })}`);

      const result = operation(term1, term2);
      // 非有限の値が返るとモデルが誤った説明を生成しやすいため拒否する。
      if (!Number.isFinite(result)) {
        throw new Error('計算結果が有限の数値ではありません。');
      }

      const serialized = { result };
      console.log('[tool] response:', JSON.stringify(serialized, null, 2));
      return serialized;
    },
  });
}

async function executeTavilySearch(query: string) {
  try {
    const { results } = await tvly.search(query, {
      includeAnswer: false,
      includeImages: false,
      maxResults: 5,
    });

    // 出典URLと要約だけに絞ることで最終回答が裏付けを示しやすくなる。
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

// 例1: 日本で5番目に高い山と世界で5番目に高い山の標高を乗じた結果は？ -> 3,180 × 8,463 = 26,912,340m or 3,180 × 8,465 = 26,982,300m
// 例2: 日本で6番目に高い山の標高から2025年の自民党の総裁選挙の決選投票における高市早苗氏の得票数を引いた結果は？ -> 3141－185＝2956
