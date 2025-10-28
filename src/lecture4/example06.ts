import type { BaseMessageLike, ContentBlock } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

type MessageLog = {
  role: string;
  content: string;
};

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
});

const messages: BaseMessageLike[] = [];
const logs: MessageLog[] = [];

for (let i = 0; i < 3; i++) {
  const userMessage = prompt(`AIへの入力 ${i + 1}/3:`);
  if (!userMessage) continue;

  messages.push(['user', userMessage]);
  logs.push({ role: 'user', content: userMessage });

  const response = await model.invoke(messages);
  const outputText = standardContentToText(response.content);

  messages.push(response);
  logs.push({ role: 'assistant', content: outputText });

  console.log('Messages:', logs);
  console.log('Output:', outputText, '\n');
}

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

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？
