/**
 * OpenAIが提供するホスト型ツール（Web検索・コード実行）をLangChain経由で利用する例。
 */

import { AIMessage, type ContentBlock } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const llm = new ChatOpenAI({
  model: 'gpt-5-mini',
});

const hostedToolModel = llm.bindTools([{ type: 'web_search' }, { type: 'code_interpreter' }], {
  parallel_tool_calls: true,
});

const promptTemplate = ChatPromptTemplate.fromMessages([
  [
    'system',
    `
あなたは与えられたホスト型ツールを使って、最新の情報収集とコード実行を行う日本語アシスタントです。
ユーザの依頼に応じて以下の方針を守ってください:
- 最新情報が必要な場合は web_search を用いて信頼できる根拠を集める。
- 数値計算やデータ整形が必要な場合は code_interpreter を使ってコードを実行し、実行内容と結果を要約する。
最終回答では検索の根拠URLと実行した計算の概要を簡潔にまとめてください。
`.trim(),
  ],
  ['human', '{input}'],
]);

const chain = promptTemplate.pipe(hostedToolModel);

const request = prompt('調査してほしいテーマやタスクを入力してください:')?.trim() ?? '';
if (!request) throw new Error('テーマが入力されませんでした。');

const response = await chain.invoke({ input: request });
if (!AIMessage.isInstance(response)) {
  throw new Error('LLMからの応答を解釈できませんでした。');
}

printToolCalls(response.additional_kwargs?.tool_calls);

console.log('\n=== 最終結果 ===\n');
console.log(contentToText(response.content));

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
        default:
          return `\n[${block.type ?? 'unknown'}]\n${JSON.stringify(block)}\n`;
      }
    })
    .filter(Boolean)
    .join('');
}

function printToolCalls(toolCalls: unknown) {
  if (!Array.isArray(toolCalls) || !toolCalls.length) return;

  console.log('\n=== 生成されたツール呼び出し ===\n');
  toolCalls.forEach((call, index) => {
    console.log(`[${index + 1}]`, JSON.stringify(call, null, 2), '\n');
  });
}

// 例1: 日本で5番目に高い山と世界で5番目に高い山の標高を乗じた結果は？ ->
//      3,180 × 8,463 = 26,912,340m or
//      3,180 × 8,465 = 26,982,300m or
//      3,180 × 8,481 = 26,969,580m or
//      3,180 × 8,485 = 26,982,300m
//      （Webサイトによってマカルーの標高の記載が異なる）
// 例2: 日本で6番目に高い山の標高から2025年の自民党の総裁選挙の決選投票における高市早苗氏の得票数を引いた結果は？ -> 3141－185＝2956
// 例3: 2025年の日本における再生可能エネルギー投資動向を調べて、主要な統計を計算し、Markdown形式で表を出力して
