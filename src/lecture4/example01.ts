import { Agent, type AgentInputItem, hostedMcpTool, Runner, withTrace } from '@openai/agents';

// Tool definitions
const mcp = hostedMcpTool({
  serverLabel: 'find_a_domain',
  serverUrl: 'https://api.findadomain.dev/mcp',
  allowedTools: [],
  requireApproval: 'never',
});
const domainChecker = new Agent({
  name: 'Domain Checker',
  instructions:
    'あなたはドメイン名の空き状況を調べるアシスタントです。findadomain MCP サーバーのツールを使ってドメインの空き状況を確認し、結果を根拠とともに日本語でまとめてください。',
  model: 'gpt-5-mini',
  tools: [mcp],
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
  return await withTrace('Domain check workflow', async () => {
    const _state = {};
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
        workflow_id: 'wf_690001b0a17c8190b74c2499003988750e7257e1eed2d0f3',
      },
    });
    const domainCheckerResultTemp = await runner.run(domainChecker, [...conversationHistory]);
    conversationHistory.push(...domainCheckerResultTemp.newItems.map((item) => item.rawItem));

    if (!domainCheckerResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const domainCheckerResult = {
      output_text: domainCheckerResultTemp.finalOutput ?? '',
    };
    return domainCheckerResult;
  });
};

const result = await runWorkflow({
  input_as_text: '早稲田大学が研究するAI技術を紹介するWebサイト用のドメイン名で、まだ取得されていないものを3つ教えて',
});
console.info(result);
