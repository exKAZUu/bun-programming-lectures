import type { BaseMessageLike } from '@langchain/core/messages';
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
  const outputText = contentToString(response.content);

  messages.push(response);
  logs.push({ role: 'assistant', content: outputText });

  console.log('Messages:', logs);
  console.log('Output:', outputText, '\n');
}

// 入力例:
// 日本の地理的な中心に位置する都道府県を一つ挙げてください。
// その南にある都道府県は？
// その南東は？

function contentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          if (typeof text === 'string') {
            return text;
          }
        }
        return '';
      })
      .join('');
  }
  return '';
}
