import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはユーザが入力した数式の計算結果を出力するAIです。あなたは数式の解析が得意ですが、足し算は苦手です。
そこで、私があなたの代わりに足し算の計算結果を伝えます。ただし、私は2つの項の足し算しかできません。
足し算が必要な場合は \`5912 + 21905\` のように、2つの項に対する足し算の式を1つだけ出力してください。
なお、あなたの出力を機械的にパースするため、数値と\`+\`以外の文字を一切出力しないでください。
全ての計算が終わった場合は、計算結果の数値だけを出力してください。
`.trim(),
  },
];

const userMessage = prompt(`数式を入力してください:`);
if (!userMessage) throw new Error('数式が入力されませんでした。');

input.push({
  role: 'user',
  content: userMessage,
});

for (let i = 0; i < 5; i++) {
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    input,
  });
  console.log('Input:', input);
  console.log('Output:', response.output_text, '\n');
  if (!response.output_text.includes('+')) break;

  const [term1, term2] = response.output_text.split('+');
  const result = Number(term1?.trim()) + Number(term2?.trim());
  if (Number.isNaN(result)) throw new Error('足し算の形式が正しくありません。');

  input.push({
    role: 'assistant',
    content: response.output_text,
  });
  input.push({
    role: 'developer',
    content: `足し算の結果は ${result} です。`,
  });
}

// 例1: 3 + 5 -> 8
// 例2: 12 + (30 + 5) -> 47
// 例3: 35179421 + 5071511 + 219647512 -> 259898444
