/**
 * 会話履歴にユーザと固定のアシスタント発話を埋め込み、後続メッセージに対する応答を取得する例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-4.1',
  temperature: 0, // ランダム性を抑える
  input: [
    {
      role: 'user',
      content: 'おはよう',
    },
    {
      // 一般的に、AI側 (assistant) の回答には、実際にAIが出力した内容を指定するが、
      // 今回はプログラマが決めた固定の回答である "Good morning" を指定している。
      role: 'assistant',
      content: 'Good morning',
    },
    {
      role: 'user',
      content: 'こんにちは',
    },
    {
      // 一般的に、AI側 (assistant) の回答には、実際にAIが出力した内容を指定するが、
      // 今回はプログラマが決めた固定の回答である "Hello" を指定している。
      role: 'assistant',
      content: 'Hello',
    },
    {
      role: 'user',
      content: 'こんばんは',
    },
  ],
});
// GPT-4.1の応答を表示
console.log(response.output_text);
