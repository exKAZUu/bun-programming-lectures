import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const response = await client.responses.create({
  model: 'gpt-4o-mini',
  temperature: 0, // ランダム性を抑える
  input: [
    {
      role: 'user',
      content: '日本の地理的な中心に位置する都道府県を一つ挙げてください。',
    },
    {
      role: 'assistant',
      content: '岐阜県',
    },
    {
      role: 'user',
      content: 'その南にある都道府県は？',
    },
  ],
});
// GPT-4o Miniの応答を表示
console.log(response.output_text);
