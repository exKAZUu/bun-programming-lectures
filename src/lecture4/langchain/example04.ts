import type { AIMessageChunk } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
});

const stream = await model.stream('400字程度の物語を作成して。');

for await (const chunk of stream) {
  const text = chunkToString(chunk);
  if (text) {
    process.stdout.write(text);
  }
}

function chunkToString(chunk: AIMessageChunk): string {
  return contentToString(chunk.content);
}

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
