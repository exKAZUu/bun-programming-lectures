/**
 * Responses APIのストリーミング出力を逐次的に処理してコンソールに書き出す例。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const stream = await client.responses.create({
  model: 'gpt-4o-mini',
  input: '400字程度の物語を作成して。',
  stream: true,
});

// GPT-4o Miniの応答を逐次的に表示
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta);
  }
}
