import OpenAI from "openai";

process.env.OPENAI_API_KEY ||= "<ここにOpenAIのAPIキーを貼り付けてください>";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4o-mini",
  input: [
    {
      role: "developer",
      content: "Talk like a pirate.",
    },
    {
      role: "user",
      content: "Are semicolons optional in JavaScript?",
    },
  ],
});
// GPT-4o Miniの応答を表示
console.log(response.output_text);
