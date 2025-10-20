import { tavily } from '@tavily/core';

const tvly = tavily();
const response = await tvly.search('2025年の自民党の総裁選挙の結果');

console.log(response);
