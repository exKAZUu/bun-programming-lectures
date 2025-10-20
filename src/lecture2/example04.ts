import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはユーザが入力した数式の計算結果を出力するAIです。あなたは数式の解析が得意ですが、計算は苦手です。
私があなたの代わりに計算しますが、私は2つの項の数式しか計算できません。
そこで、演算子の優先順位を考慮して、2つの項だけから成る数式を1つ出力してください。
それに対して、私が計算結果を伝えるので、次に計算すべき2つの項から成る数式を出力してください。
このように、あなたと私が協力して少しずつ計算することで、最終的な計算結果を導きましょう！
なお、あなたの出力を機械的にパースするため、数値と演算子以外の文字を一切出力しないでください。
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

for (let i = 0; i < 10; i++) {
  const response = await client.responses.create({
    model: 'gpt-5-mini',
    input,
  });
  console.log('Input:', input);
  console.log('Output:', response.output_text, '\n');
  // 数値だけが出力されたら終了
  if (/^[-+]?\d+$/.test(response.output_text)) break;

  const regex = /^\s*([-+]?\d+)\s*([+\-*/])\s*([-+]?\d+)\s*$/;
  const [_, term1, operator, term2] = response.output_text.match(regex) ?? [];
  const result = calculate(Number(term1), operator, Number(term2));
  if (Number.isNaN(result)) throw new Error('計算の形式が正しくありません。');

  input.push({
    role: 'assistant',
    content: response.output_text,
  });
  input.push({
    role: 'developer',
    content: `計算結果は ${result} です。`,
  });
}

function calculate(term1: number, operator: string | undefined, term2: number): number {
  switch (operator) {
    case '+':
      return term1 + term2;
    case '-':
      return term1 - term2;
    case '*':
      return term1 * term2;
    case '/':
      return term1 / term2;
    default:
      return NaN;
  }
}

// 例1: 5178952 + 25198791 -> 30377743
// 例2: 3 + 5 * 2 - 4 -> 9
// 例3: (10 - 2) * (3 + 4) / 2 -> 28
