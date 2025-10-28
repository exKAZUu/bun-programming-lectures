/**
 * LangChainのChatOpenAIを使って単発プロンプトから物語を生成する最小限の例。
 */

import type { ContentBlock } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
});

const response = await model.invoke('400字程度の物語を作成して。');

console.log(contentToText(response.content));

function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((block) => (block as ContentBlock.Text).text)
    .filter(Boolean)
    .join('');
}
