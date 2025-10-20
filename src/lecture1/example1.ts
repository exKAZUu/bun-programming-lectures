import OpenAI from "openai";

process.env.OPENAI_API_KEY ||= "<ここにOpenAIのAPIキーを貼り付けてください>";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5-nano",
  input: "こんにちは",
});
// GPT-5 Nanoの応答を表示
console.log(response.output_text);
