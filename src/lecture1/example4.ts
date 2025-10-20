import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-5-nano',
  input: [
    {
      role: 'user',
      content: 'おはよう',
    },
    {
      role: 'assistant',
      content: 'Good morning',
    },
    {
      role: 'user',
      content: 'こんにちは',
    },
    {
      role: 'assistant',
      content: 'Hello',
    },
    {
      role: 'user',
      content: 'こんばんは',
    },
  ],
});
// GPT-5 Nanoの応答を表示
console.log(response.output_text);
