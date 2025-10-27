import { Agent, codeInterpreterTool, run, webSearchTool } from '@openai/agents';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const agent = new Agent({
  name: 'Hosted tool researcher',
  instructions: `
あなたは与えられたツールを使って、最新の情報収集・コード実行を行う日本語アシスタントです。
ユーザの依頼に応じて以下の方針を守ってください:
- インターネット上の最新情報が必要な場合は web_search を用いて信頼できる根拠を集める。
- 数値計算やデータ整形が必要な場合は code_interpreter を使ってコードを実行し、実行内容と結果を要約する。
最終回答では検索の根拠URLと実行した計算の概要を簡潔にまとめてください。
`.trim(),
  model: 'gpt-5-mini',
  tools: [webSearchTool({ searchContextSize: 'medium' }), codeInterpreterTool()],
});

const request = prompt(`調査してほしいテーマやタスクを入力してください:`)?.trim() ?? '';
if (!request) throw new Error('テーマが入力されませんでした。');

const response = await run(agent, request, { maxTurns: 10 });

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
  console.log('回答を生成できませんでした。');
}

// 例1: 日本で5番目に高い山と世界で5番目に高い山の標高を乗じた結果は？ -> 3,180 × 8,463 = 26,912,340m or 3,180 × 8,465 = 26,982,300m
// 例2: 日本で6番目に高い山の標高から2025年の自民党の総裁選挙の決選投票における高市早苗氏の得票数を引いた結果は？ -> 3141－185＝2956
// 例3: 2025年の日本における再生可能エネルギー投資動向を調べて、主要な統計を計算し、Markdown形式で表を出力して
