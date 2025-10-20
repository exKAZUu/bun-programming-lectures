import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const stream = await client.responses.create({
  model: 'gpt-4o-mini',
  input: '400字程度の物語を作成して。',
});

// GPT-4o Miniの応答を表示
console.log(stream.output_text);
