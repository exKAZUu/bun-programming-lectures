/**
 * 足し算リクエストをJSON形式で出力させ、ホスト側で解析・計算してフィードバックする例 (GPT-4o Mini版)。
 */

import OpenAI from 'openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const client = new OpenAI();

const input: OpenAI.Responses.ResponseCreateParams['input'] = [
  {
    role: 'developer',
    content: `
あなたはユーザが入力した数式の計算結果を出力するAIです。あなたは数式の解析が得意ですが、足し算は苦手です。
そこで、私があなたの代わりに足し算を計算します。ただし、私は2つの項の足し算しかできません。
あなたが私に計算を依頼する場合、 \`{ "operand1": 5912, "operator": "+", "operand2": 21905 }\` というJSON形式で、2つの項に対する足し算の式を1つだけ出力してください。
私はあなたの出力を機械的にパースするため、上記の形式のJSONを1つだけ出力してください。
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
  try {
    const parsed = JSON.parse(response.output_text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'operand1' in parsed &&
      'operator' in parsed &&
      'operand2' in parsed &&
      parsed.operator === '+'
    ) {
      const result = parsed.operand1 + parsed.operand2;
      if (Number.isNaN(result)) throw new Error('JSON形式が正しくありません。');

      input.push({
        role: 'assistant',
        content: response.output_text,
      });
      input.push({
        role: 'developer',
        content: `足し算の結果は ${result} です。`,
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

// 例1: 3 + 5 -> 8
// 例2: 12 + 30 + 5 -> 47
// 例3: 35179421 + 5071511 + 219647512 -> 259898444
