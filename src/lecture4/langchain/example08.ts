import { type BaseMessage, HumanMessage, isHumanMessage } from '@langchain/core/messages';
import { Annotation, END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const mcpClient = new MultiServerMCPClient({
  find_a_domain: {
    transport: 'sse',
    url: 'https://api.findadomain.dev/mcp',
    automaticSSEFallback: true,
  },
});

const domainTools = (await mcpClient.getTools(['find_a_domain'])).filter(
  (tool) => tool.name === 'check_domain' || tool.name === 'list_tlds'
);

const DomainSuggestionSchema = z.object({
  domain_cnadidates: z.array(z.string()),
  web_service_content: z.string(),
});

const DomainSelectionSchema = z.object({
  domain_to_register: z.string(),
  reason: z.string(),
});

type DomainSuggestion = z.infer<typeof DomainSuggestionSchema>;
type DomainSelection = z.infer<typeof DomainSelectionSchema>;

const domainSuggesterAgent = createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }),
  tools: domainTools,
  systemPrompt:
    'あなたはドメイン名を提案するアシスタントです。ユーザが説明したWebサービスの内容を踏まえて、findadomain MCP サーバーのツールを使って空き状況を確認し、取得候補を5件提案してください。結果は domain_cnadidates（文字列の配列）と web_service_content（要約テキスト）のJSONで出力してください。',
});

const domainSelectorAgent = createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o', temperature: 0 }),
  systemPrompt:
    'あなたは取得すべきドメインを選定するアシスタントです。与えられた候補から1つだけ選び、選定理由を日本語で説明してください。回答は domain_to_register と reason を持つJSONで返してください。',
});

const DomainWorkflowState = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  suggestions: Annotation<string[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
  webServiceContent: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  selectedDomain: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  selectionReason: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

const domainWorkflowGraph = createDomainWorkflowGraph();

type WorkflowInput = { input_as_text: string };

export const runWorkflow = async (workflow: WorkflowInput) => {
  const initialMessages = [new HumanMessage(workflow.input_as_text)];
  const finalState = await domainWorkflowGraph.invoke({ messages: initialMessages });

  if (finalState.selectedDomain == null || finalState.selectionReason == null) {
    throw new Error('ドメイン選定に失敗しました。');
  }

  return {
    output_text: formatSelectionResult(finalState.selectedDomain, finalState.selectionReason),
    output_parsed: {
      domain_cnadidates: finalState.suggestions,
      web_service_content: finalState.webServiceContent ?? workflow.input_as_text,
      selected_domain: finalState.selectedDomain,
      reason: finalState.selectionReason,
    },
  };
};

const result = await runWorkflow({
  input_as_text: '早稲田大学が研究するAI技術を紹介するWebサイト',
});
console.info(result);

function createDomainWorkflowGraph() {
  return new StateGraph(DomainWorkflowState)
    .addNode('suggestDomains', suggestDomains)
    .addNode('selectDomain', selectDomain)
    .addEdge(START, 'suggestDomains')
    .addEdge('suggestDomains', 'selectDomain')
    .addEdge('selectDomain', END)
    .compile();
}

async function suggestDomains(state: typeof DomainWorkflowState.State) {
  const agentState = await domainSuggesterAgent.invoke({ messages: state.messages });

  if (agentState.structuredResponse == null) {
    throw new Error('ドメイン候補の取得に失敗しました。');
  }

  return {
    messages: extractNewMessages(state.messages, agentState.messages),
    suggestions: agentState.structuredResponse.domain_cnadidates,
    webServiceContent: agentState.structuredResponse.web_service_content,
  };
}

async function selectDomain(state: typeof DomainWorkflowState.State) {
  if (state.suggestions.length === 0) {
    throw new Error('ドメイン候補が存在しません。');
  }

  const selectionPrompt = new HumanMessage(formatSelectionPrompt(state));
  const agentState = await domainSelectorAgent.invoke({ messages: [selectionPrompt] });

  if (agentState.structuredResponse == null) {
    throw new Error('ドメインの選定に失敗しました。');
  }

  return {
    messages: agentState.messages,
    selectedDomain: agentState.structuredResponse.domain_to_register,
    selectionReason: agentState.structuredResponse.reason,
  };
}

function formatSelectionPrompt(state: typeof DomainWorkflowState.State): string {
  const list = state.suggestions.map((domain, index) => `${index + 1}. ${domain}`).join('\n');
  const baseContent = state.webServiceContent ?? findFirstUserMessage(state.messages) ?? '';
  return `以下のWebサービスの説明を踏まえて、候補の中から取得すべきドメインを1つ選び、理由を教えてください。\n\nWebサービスの説明:\n${baseContent}\n\n候補ドメイン:\n${list}`;
}

function findFirstUserMessage(messages: BaseMessage[]): string | null {
  const message = messages.find((item) => isHumanMessage(item));
  if (message == null) {
    return null;
  }
  return typeof message.content === 'string' ? message.content : '';
}

function extractNewMessages(previous: BaseMessage[], updated: BaseMessage[]): BaseMessage[] {
  if (updated.length <= previous.length) {
    return [];
  }
  return updated.slice(previous.length);
}

function formatSelectionResult(domain: string, reason: string): string {
  return `選定ドメイン: ${domain}\n理由: ${reason}`;
}
