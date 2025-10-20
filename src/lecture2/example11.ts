import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const tools: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'add',
    description: '2つの数値を加算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '加算する1つ目の数値' },
        term2: { type: 'number', description: '加算する2つ目の数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'sub',
    description: '2つの数値を減算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '減算される数値' },
        term2: { type: 'number', description: '減算する数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'mul',
    description: '2つの数値を乗算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '乗算する1つ目の数値' },
        term2: { type: 'number', description: '乗算する2つ目の数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'div',
    description: '2つの数値を除算します',
    parameters: {
      type: 'object',
      properties: {
        term1: { type: 'number', description: '除算される数値' },
        term2: { type: 'number', description: '除算する数値' },
      },
      required: ['term1', 'term2'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const userMessage = prompt(`数式を入力してください:`);
if (!userMessage) throw new Error('数式が入力されませんでした。');

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはユーザが入力した数式の計算結果を出力するAIです。
演算子の優先順位を考慮して、提供されている関数を使って少しずつ計算してください。
全ての計算が終わったら、最終的な計算結果の数値だけを出力してください。
`.trim(),
  },
  {
    role: 'user',
    content: userMessage,
  },
];

for (let i = 0; i < 10; i++) {
  const response = await client.responses.create({
    model: 'gpt-4.1',
    temperature: 0,
    tools,
    input,
  });

  console.log('Input:', input);
  console.log('Output:');
  console.dir(response.output, { depth: null });

  let hasFunctionCall = false;
  for (const item of response.output) {
    if (item.type === 'function_call') {
      hasFunctionCall = true;
      input.push(item);

      const args = JSON.parse(item.arguments);
      const result = calculate(item.name, [args.term1, args.term2]);

      input.push({
        type: 'function_call_output',
        call_id: item.call_id,
        output: JSON.stringify({ result }),
      });
    }
  }

  if (!hasFunctionCall) {
    break;
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
