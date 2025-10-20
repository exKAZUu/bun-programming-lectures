import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const time1 = Date.now();
const response1 = await client.responses.create({
  model: 'gpt-4o-mini',
  // 正解は 216,569,344,906
  input: '421097×514298の計算結果を教えて',
});
// GPT-4o Miniの応答を表示
console.log(response1.output_text, `（処理時間: ${Date.now() - time1} ms）`);
// 入出力のトークン数を表示
console.log(response1.usage);

const time2 = Date.now();
const response2 = await client.responses.create({
  model: 'gpt-5-nano',
  // 正解は 216,569,344,906
  input: '421097×514298の計算結果を教えて',
});
// GPT-5 Nanoの応答を表示
console.log(response2.output_text, `（処理時間: ${Date.now() - time2} ms）`);
// 入出力のトークン数を表示
console.log(response2.usage);
