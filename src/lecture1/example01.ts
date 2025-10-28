/**
 * OpenAI Responses APIを使ってGPT-4o Miniへ単発の挨拶プロンプトを送る最小構成の例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const response = await client.responses.create({
  // 使用するOpenAIのモデル名
  model: 'gpt-4o-mini',
  // LLMに対する入力内容
  input: 'おはよう',
});
// GPT-4o Miniの応答を表示
console.log(response.output_text);
