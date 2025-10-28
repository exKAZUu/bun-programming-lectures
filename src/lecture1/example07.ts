/**
 * コンソール入力を使って最大3回までユーザの追加入力を受け取りつつ応答と履歴を蓄積する対話例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const input: OpenAI.Responses.ResponseCreateParams['input'] = [];

for (let i = 0; i < 3; i++) {
  const userMessage = prompt(`AIへの入力 ${i + 1}/3:`);
  if (!userMessage) continue;

  input.push({
    role: 'user',
    content: userMessage,
  });

  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0, // ランダム性を抑える
    input,
  });
  console.log('Input:', input);
  console.log('Output:', response.output_text, '\n');

  input.push({
    role: 'assistant',
    content: response.output_text,
  });
}

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？
