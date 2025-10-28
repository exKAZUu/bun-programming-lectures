/**
 * Responses APIで会話履歴を配列で管理しながらフォローアップ質問を段階的に投げる例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'user',
    content: '日本の地理的な中心に位置する都道府県を一つ挙げてください。',
  },
];

const response1 = await client.responses.create({
  model: 'gpt-4o-mini',
  temperature: 0, // ランダム性を抑える
  input,
});
console.log(response1.output_text);

input.push({
  role: 'assistant',
  content: response1.output_text,
});
input.push({
  role: 'user',
  content: 'その南にある都道府県は？',
});

const response2 = await client.responses.create({
  model: 'gpt-4o-mini',
  temperature: 0, // ランダム性を抑える
  input,
});
console.log(response2.output_text);
