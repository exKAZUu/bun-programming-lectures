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
なお、あなたの出力を機械的にパースするため、\`{ "function": "add", "parameters": [5912, 21905] }\` というJSON形式の文字列のみを出力してください。
\`function\` に指定できる関数は、 "add", "sub", "mul", "div" のいずれかです。
また、全ての計算が終わった場合は、計算結果の数値だけを出力してください。
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
  try {
    const parsed = JSON.parse(response.output_text);
    if (typeof parsed === 'object' && parsed !== null && 'function' in parsed && 'parameters' in parsed) {
      const result = calculate(parsed.function, parsed.parameters);
      if (Number.isNaN(result)) throw new Error('JSON形式が正しくありません。');

      input.push({
        role: 'assistant',
        content: response.output_text,
      });
      input.push({
        role: 'developer',
        content: `計算結果は ${result} です。`,
      });
    } else {
      // 計算が終わった場合
      break;
    }
  } catch {
    // JSONのパースに失敗した場合
    throw new Error('JSON形式が正しくありません。');
  }
}

function calculate(func: string, parameters: [number, number]): number {
  const [term1, term2] = parameters;
  switch (func) {
    case 'add':
      return term1 + term2;
    case 'sub':
      return term1 - term2;
    case 'mul':
      return term1 * term2;
    case 'div':
      return term1 / term2;
    default:
      return NaN;
  }
}

// 例1: 5178952 + 25198791 -> 30377743
// 例2: 3 + 5 * 2 - 4 -> 9
// 例3: (10 - 2) * (3 + 4) / 2 -> 28
