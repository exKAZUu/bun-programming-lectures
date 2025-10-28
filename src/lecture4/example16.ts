import { AIMessage, type BaseMessage, HumanMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { Annotation, END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, type ReactAgent, type ResponseFormatUndefined } from 'langchain';
import { z } from 'zod';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

if (process.env.OPENAI_API_KEY.includes('<ここにOpenAIのAPIキーを貼り付けてください>')) {
  console.warn('OPENAI_API_KEYを設定すると、このサンプルを実行できます。設定されていないため処理をスキップします。');
  process.exit(0);
}

const DomainSuggestionSchema = z.object({
  domainCandidates: z.array(z.string()),
  webServiceContent: z.string(),
});

const DomainSelectionSchema = z.object({
  domainToRegister: z.string(),
  reason: z.string(),
});

type DomainSuggestion = z.infer<typeof DomainSuggestionSchema>;
type DomainSelection = z.infer<typeof DomainSelectionSchema>;
type DomainWorkflowComponents = {
  suggesterAgent: ReactAgent<ResponseFormatUndefined>;
  selectorAgent: ReactAgent<ResponseFormatUndefined>;
  graph: ReturnType<typeof createDomainWorkflowGraph>;
};
type DomainWorkflowRuntime = {
  components?: DomainWorkflowComponents;
  toolsClient?: MultiServerMCPClient;
  toolsCache: DynamicStructuredTool[] | null;
};

const domainWorkflowRuntime: DomainWorkflowRuntime = {
  toolsCache: null,
};

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

type WorkflowInput = { input_as_text: string };

export const runWorkflow = async (workflow: WorkflowInput) => {
  const components = await ensureWorkflowInitialized();
  const initialMessages = [new HumanMessage(workflow.input_as_text)];
  const finalState = await components.graph.invoke({ messages: initialMessages });

  if (finalState.selectedDomain == null || finalState.selectionReason == null) {
    throw new Error('ドメイン選定に失敗しました。');
  }

  return {
    output_text: formatSelectionResult(finalState.selectedDomain, finalState.selectionReason),
    output_parsed: {
      domainCandidates: finalState.suggestions,
      webServiceContent: finalState.webServiceContent ?? workflow.input_as_text,
      selectedDomain: finalState.selectedDomain,
      reason: finalState.selectionReason,
    },
  };
};

if (import.meta.main) {
  const result = await runWorkflow({
    input_as_text: '早稲田大学が研究するAI技術を紹介するWebサイト',
  });
  console.info(result);
  process.exit(0);
}

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
  const { suggesterAgent } = getDomainWorkflowComponents();
  const agentState = await suggesterAgent.invoke({ messages: state.messages });
  const suggestion = parseSuggestion(agentState.messages);
  return {
    messages: extractNewMessages(state.messages, agentState.messages),
    suggestions: suggestion.domainCandidates,
    webServiceContent: suggestion.webServiceContent,
  };
}

async function selectDomain(state: typeof DomainWorkflowState.State) {
  if (state.suggestions.length === 0) {
    throw new Error('ドメイン候補が存在しません。');
  }

  const selectionPrompt = new HumanMessage(formatSelectionPrompt(state));
  const { selectorAgent } = getDomainWorkflowComponents();
  const agentState = await selectorAgent.invoke({ messages: [selectionPrompt] });
  const selection = parseSelection(agentState.messages);
  return {
    messages: agentState.messages,
    selectedDomain: selection.domainToRegister,
    selectionReason: selection.reason,
  };
}

function formatSelectionPrompt(state: typeof DomainWorkflowState.State): string {
  const list = state.suggestions.map((domain, index) => `${index + 1}. ${domain}`).join('\n');
  const baseContent = state.webServiceContent ?? findFirstUserMessage(state.messages) ?? '';
  return `以下のWebサービスの説明を踏まえて、候補の中から取得すべきドメインを1つ選び、理由を教えてください。\n\nWebサービスの説明:\n${baseContent}\n\n候補ドメイン:\n${list}`;
}

function findFirstUserMessage(messages: BaseMessage[]): string | null {
  const message = messages.find((item) => HumanMessage.isInstance(item));
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

async function ensureWorkflowInitialized(): Promise<DomainWorkflowComponents> {
  if (domainWorkflowRuntime.components != null) {
    return domainWorkflowRuntime.components;
  }

  const tools = await loadDomainTools();
  const components: DomainWorkflowComponents = {
    suggesterAgent: createAgent({
      model: new ChatOpenAI({ model: 'gpt-5-mini' }),
      tools,
      systemPrompt:
        'あなたはドメイン名を提案するアシスタントです。ユーザが説明したWebサービスの内容を踏まえて、findadomain MCP サーバーのツールを使って空き状況を確認し、取得候補を5件提案してください。結果は domainCandidates（文字列の配列）と webServiceContent（要約テキスト）のJSONで出力してください。',
    }),
    selectorAgent: createAgent({
      model: new ChatOpenAI({ model: 'gpt-5' }),
      systemPrompt:
        'あなたは取得すべきドメインを選定するアシスタントです。与えられた候補から1つだけ選び、選定理由を日本語で説明してください。回答は domainToRegister と reason を持つJSONで返してください。',
    }),
    graph: createDomainWorkflowGraph(),
  };

  domainWorkflowRuntime.components = components;
  return components;
}

function getDomainWorkflowComponents(): DomainWorkflowComponents {
  if (domainWorkflowRuntime.components == null) {
    throw new Error('Domain workflow is not initialized.');
  }
  return domainWorkflowRuntime.components;
}

async function loadDomainTools() {
  if (domainWorkflowRuntime.toolsCache != null) {
    return domainWorkflowRuntime.toolsCache;
  }

  if (domainWorkflowRuntime.toolsClient == null) {
    domainWorkflowRuntime.toolsClient = new MultiServerMCPClient({
      useStandardContentBlocks: true,
      mcpServers: {
        find_a_domain: {
          transport: 'http',
          url: 'https://api.findadomain.dev/mcp',
        },
      },
    });
  }

  try {
    const tools = await promiseWithTimeout(
      domainWorkflowRuntime.toolsClient
        .getTools(['find_a_domain'])
        .then((loadedTools) => loadedTools.filter((tool) => tool.name === 'check_domain' || tool.name === 'list_tlds')),
      15000,
      'MCPサーバーからのレスポンスがタイムアウトしました。'
    );

    if (tools.length === 0) {
      console.warn('find_a_domain MCPのツールが取得できなかったため、LLMのみで候補を生成します。');
    }

    domainWorkflowRuntime.toolsCache = tools;
    return tools;
  } catch (error) {
    console.warn('find_a_domain MCP サーバーに接続できなかったため、LLMのみで候補を生成します。', error);
    await domainWorkflowRuntime.toolsClient?.close().catch(() => {
      // ignore close errors
    });
    domainWorkflowRuntime.toolsClient = undefined;
    domainWorkflowRuntime.toolsCache = null;
    return [];
  }
}

async function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle != null) {
      clearTimeout(timeoutHandle);
    }
  }
}

function parseSuggestion(messages: BaseMessage[]): DomainSuggestion {
  const aiMessage = findLastAIMessage(messages);
  try {
    return parseJson(aiMessage, DomainSuggestionSchema, 'ドメイン候補の解析に失敗しました');
  } catch (primaryError) {
    const fallback = parseSuggestionFallback(aiMessage);
    if (fallback != null) {
      return fallback;
    }
    throw primaryError;
  }
}

function parseSelection(messages: BaseMessage[]): DomainSelection {
  const aiMessage = findLastAIMessage(messages);
  return parseJson(aiMessage, DomainSelectionSchema, 'ドメインの選定結果を解析できませんでした');
}

function findLastAIMessage(messages: BaseMessage[]): AIMessage {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message != null && AIMessage.isInstance(message)) {
      return message;
    }
  }
  throw new Error('AIメッセージが見つかりませんでした。');
}

function parseJson<T>(message: AIMessage, schema: z.ZodType<T>, parseErrorMessage: string): T {
  const raw = messageContentToString(message);
  try {
    const jsonText = extractJsonPayload(raw) ?? raw;
    const parsed = schema.parse(JSON.parse(jsonText));
    return parsed;
  } catch (_error) {
    throw new Error(`${parseErrorMessage}: ${raw}`);
  }
}

function parseSuggestionFallback(message: AIMessage): DomainSuggestion | null {
  const raw = messageContentToString(message);
  try {
    const jsonText = extractJsonPayload(raw) ?? raw;
    const parsed = JSON.parse(jsonText);
    if (
      Array.isArray(parsed.domainCandidates) &&
      parsed.domainCandidates.every((item: unknown) => typeof item === 'string') &&
      typeof parsed.webServiceContent === 'string'
    ) {
      return {
        domainCandidates: parsed.domainCandidates as string[],
        webServiceContent: parsed.webServiceContent as string,
      };
    }
  } catch (error) {
    console.warn('JSONの解析に失敗しました。', error);
  }
  return null;
}

function messageContentToString(message: AIMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content
    .map((block: unknown) => {
      if (typeof block === 'string') {
        return block;
      }
      if (typeof block === 'object' && block != null && 'text' in block) {
        const candidate = (block as { text?: unknown }).text;
        if (typeof candidate === 'string') {
          return candidate;
        }
      }
      return '';
    })
    .join('')
    .trim();
}

function extractJsonPayload(raw: string): string | null {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1).trim();
  }

  return null;
}
