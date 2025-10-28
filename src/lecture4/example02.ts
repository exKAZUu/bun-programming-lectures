import { Agent, type AgentInputItem, hostedMcpTool, Runner, withTrace } from '@openai/agents';
import { z } from 'zod';

// Tool definitions
const mcp = hostedMcpTool({
  serverLabel: 'find_a_domain',
  allowedTools: ['check_domain', 'list_tlds'],
  requireApproval: 'never',
  serverUrl: 'https://api.findadomain.dev/mcp',
});
const DomainSuggesterSchema = z.object({ domain_cnadidates: z.array(z.string()), web_service_content: z.string() });
const domainSuggester = new Agent({
  name: 'Domain suggester',
  instructions:
    'あなたはドメイン名を提案するアシスタントです。ユーザが入力したWebサービスの内容を踏まえて、findadomain MCP サーバーのツールを使ってドメインの空き状況を確認し、5つの取得すべきドメインを提案してください。',
  model: 'gpt-5-mini',
  tools: [mcp],
  outputType: DomainSuggesterSchema,
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

const domainSelector = new Agent({
  name: 'Domain selector',
  instructions:
    'あなたは取得すべきドメインを選ぶアシスタントです。Webサービスの内容を踏まえて、取得すべきドメインを1つ選択し、理由とともに選択結果を出力してください。',
  model: 'gpt-5',
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

type WorkflowInput = { input_as_text: string };

// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace('Domain suggester', async () => {
    const state = {};
    const conversationHistory: AgentInputItem[] = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: workflow.input_as_text,
          },
        ],
      },
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: 'agent-builder',
        workflow_id: 'wf_69004f7aadfc8190b474b6fae3b1c7dc02a715713f042c76',
      },
    });
    const domainSuggesterResultTemp = await runner.run(domainSuggester, [...conversationHistory]);
    conversationHistory.push(...domainSuggesterResultTemp.newItems.map((item) => item.rawItem));

    if (!domainSuggesterResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const domainSuggesterResult = {
      output_text: JSON.stringify(domainSuggesterResultTemp.finalOutput),
      output_parsed: domainSuggesterResultTemp.finalOutput,
    };
    const domainSelectorResultTemp = await runner.run(domainSelector, [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: ` ${domainSuggesterResult.output_text}`,
          },
        ],
      },
    ]);
    conversationHistory.push(...domainSelectorResultTemp.newItems.map((item) => item.rawItem));

    if (!domainSelectorResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const domainSelectorResult = {
      output_text: domainSelectorResultTemp.finalOutput ?? '',
    };
    return domainSelectorResult;
  });
};

const result = await runWorkflow({
  input_as_text: '早稲田大学が研究するAI技術を紹介するWebサイト',
});
console.info(result);
