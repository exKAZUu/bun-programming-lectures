/**
 * Tavilyツールを使って情報を検索するエージェントの例。
 * src/lecture2/example14.ts のAgents SDK版。
 */

import { Agent, run, tool } from '@openai/agents';
import { tavily } from '@tavily/core';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';
process.env.TAVILY_API_KEY ||= 'tvly-<ここにTavilyのAPIキーを貼り付けてください>';

const tvly = tavily();
const tavilySearch = createTavilySearchTool();

const agent = new Agent({
  name: 'Research assistant',
  instructions: `
あなたはウェブ検索と大規模言語モデルを組み合わせて最新情報を回答する日本語のリサーチアシスタントです。
tavily_searchツールだけを使って必要な情報を探し、根拠となるURLを出典として記載してください。
最終的な回答では見出しや箇条書きなどを用いて読みやすくまとめ、最後に参考URLを列挙してください。
`.trim(),
  model: 'gpt-4.1',
  modelSettings: {
    temperature: 0,
  },
  tools: [tavilySearch],
});

const question = prompt(`調べたい質問を入力してください:`);
if (!question) throw new Error('質問が入力されませんでした。');

const response = await run(agent, question, { maxTurns: 6 });

if (response.newItems.length > 0) {
  console.log('\n=== 生成されたアイテム ===\n');
  console.dir(
    response.newItems.map((item) => item.toJSON()),
    { depth: null }
  );
}

const finalOutput = response.finalOutput;
console.log('\n=== 回答 ===\n');
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
    description: '最新のウェブ検索結果を取得して、ユーザの質問に答えるための情報を探します。',
    parameters: z
      .object({
        query: z.string().min(1).describe('検索エンジンに投げる日本語または英語のクエリ'),
      })
      .strict(),
    strict: true,
    async execute({ query }) {
      return await executeTavilySearch(query);
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

    // LLMに渡す情報量を絞ることで推論コストと誤情報の混入リスクを抑える。
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

// 例1: 2025年のノーベル平和賞は誰が受賞した？
// 例2: 2025年の自民党の総裁選挙の結果は？
