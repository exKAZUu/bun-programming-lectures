import {
  Agent,
  codeInterpreterTool,
  imageGenerationTool,
  OpenAIResponsesModel,
  run,
  webSearchTool,
} from '@openai/agents';
import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const openai = new OpenAI();
// OpenAIResponsesModel expects the SDK instance from its internal dependency set, so we cast here.
const model = new OpenAIResponsesModel(
  openai as unknown as ConstructorParameters<typeof OpenAIResponsesModel>[0],
  'gpt-4.1'
);

const agent = new Agent({
  name: 'Hosted tool researcher',
  instructions: `
あなたはOpenAIが提供するホスト型ツールのみを使って、最新の情報収集・コード実行・画像生成を組み合わせる日本語アシスタントです。
ユーザの依頼に応じて以下の方針を守ってください:
- インターネット上の最新情報が必要な場合は web_search を用いて信頼できる根拠を集める。
- 数値計算やデータ整形が必要な場合は code_interpreter を使ってコードを実行し、実行内容と結果を要約する。
- 図やサムネイルが有用な場合のみ image_generation を使い、生成した画像の用途を説明する。
最終回答では検索の根拠URL、実行した計算の概要、生成した画像があれば用途を明記し、簡潔にまとめてください。
`.trim(),
  model,
  modelSettings: {
    temperature: 0,
  },
  tools: [
    webSearchTool({ searchContextSize: 'medium' }),
    codeInterpreterTool(),
    imageGenerationTool({ size: '1024x1024', quality: 'medium' }),
  ],
});

const request =
  prompt(
    `調査してほしいテーマやタスクを入力してください（例: 「最新版の炭素排出量動向を分析して見やすい表を作って」）:`
  )?.trim() ?? '';
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

// 例: 「2025年の日本における再生可能エネルギー投資動向を調べて、主要な統計を計算し、説明用のサムネイル画像も用意して」 など
