import type { ContentBlock } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
});

const stream = await model.stream('400字程度の物語を作成して。');

for await (const chunk of stream) {
  const text = toText(chunk.content);
  if (text) {
    process.stdout.write(text);
  }
}

function toText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block) => {
      switch (block.type) {
        case 'text':
          return block.text;
        case 'reasoning':
          return block.reasoning;
        default:
          return '';
      }
    })
    .join('');
}
