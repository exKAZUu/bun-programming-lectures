import type { ContentBlock } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const model = new ChatOpenAI({
  model: 'gpt-4.1',
  temperature: 0,
});

const response = await model.invoke([
  ['user', 'おはよう'],
  ['assistant', 'Good morning'],
  ['user', 'こんにちは'],
  ['assistant', 'Hello'],
  ['user', 'こんばんは'],
]);

console.log(standardContentToText(response.content));

function standardContentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block): string => {
      switch (block.type) {
        case 'text': {
          const { text } = block as { text?: unknown };
          return typeof text === 'string' ? text : '';
        }
        case 'reasoning': {
          const { reasoning } = block as { reasoning?: unknown };
          return typeof reasoning === 'string'
            ? `\n[Reasoning]\n${reasoning}\n[/Reasoning]\n`
            : '';
        }
        default:
          return '';
      }
    })
    .filter((part): part is string => part.length > 0)
    .join('');
}
