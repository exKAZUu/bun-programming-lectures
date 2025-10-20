import { tavily } from '@tavily/core';
import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';
process.env.TAVILY_API_KEY ||= 'tvly-<ここにTavilyのAPIキーを貼り付けてください>';

const client = new OpenAI();
const tvly = tavily();

const tools: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'tavily_search',
    description: '最新のウェブ検索結果を取得して、ユーザの質問に答えるための情報を探します。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索エンジンに投げる日本語または英語のクエリ',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const question = prompt(`調べたい質問を入力してください:`);
if (!question) throw new Error('質問が入力されませんでした。');

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはウェブ検索と大規模言語モデルを組み合わせて最新情報を回答する日本語のリサーチアシスタントです。
tavily_searchツールだけを使って必要な情報を探し、根拠となるURLを出典として記載してください。
最終的な回答では見出しや箇条書きなどを用いて読みやすくまとめ、最後に参考URLを列挙してください。
`.trim(),
  },
  {
    role: 'user',
    content: question,
  },
];

let finalText = '';
for (let turn = 0; turn < 6; turn++) {
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

      const args = parseFunctionArguments(item.arguments);
      const searchResult = await executeTavilySearch(args.query);

      input.push({
        type: 'function_call_output',
        call_id: item.call_id,
        output: JSON.stringify(searchResult),
      });
    }
  }

  if (!madeToolCall) {
    finalText = response.output_text ?? '';
    break;
  }
}

console.log('\n=== 回答 ===\n');
console.log(finalText || '回答を生成できませんでした。');

function parseFunctionArguments(rawArguments: string | null | undefined): { query: string } {
  if (!rawArguments) throw new Error('ツール呼び出しの引数が見つかりませんでした。');

  const parsed = JSON.parse(rawArguments) as { query?: unknown };
  if (typeof parsed.query !== 'string' || !parsed.query.trim()) {
    throw new Error('検索クエリが正しく取得できませんでした。');
  }

  return { query: parsed.query };
}

async function executeTavilySearch(query: string) {
  try {
    const { results } = await tvly.search(query, {
      includeAnswer: false,
      includeImages: false,
      maxResults: 5,
    });

    // LLMにはタイトル・URL・抜粋だけを渡すことで、不要に長いコンテキストを避ける。
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
