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

console.log(contentToString(response.content));

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
