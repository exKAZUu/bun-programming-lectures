/**
 * Developerロールで翻訳方針を指示し、単発でユーザ入力を英訳するResponses APIの例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-4o',
  temperature: 0, // ランダム性を抑える
  input: [
    {
      role: 'developer',
      content: 'ユーザの入力を英訳してください。',
    },
    {
      role: 'user',
      content: 'おはよう',
    },
  ],
});
// GPT-4oの応答を表示
console.log(response.output_text);
