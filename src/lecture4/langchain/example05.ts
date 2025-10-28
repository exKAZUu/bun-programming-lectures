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

console.log(contentToText(response.content));

function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block) => {
      switch (block.type) {
        case 'text': {
          const { text } = block as ContentBlock.Text;
          return text;
        }
        case 'reasoning': {
          const { reasoning } = block as ContentBlock.Reasoning;
          return `\n[Reasoning]\n${reasoning}\n[/Reasoning]\n`;
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('');
}
