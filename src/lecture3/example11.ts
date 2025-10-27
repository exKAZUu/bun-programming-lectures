import type { Computer } from '@openai/agents';
import { Agent, computerTool, run, webSearchTool } from '@openai/agents';
import { chromium } from 'playwright';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const request = prompt(`調査してほしいテーマやタスクを入力してください:`)?.trim() ?? '';
if (!request) {
  throw new Error('テーマが入力されませんでした。');
}

const { computer, dispose } = await createPlaywrightComputer();

const agent = new Agent({
  name: 'Browser researcher',
  instructions: `
あなたは web_search と computer_use_preview を使って最新の情報を集める日本語アシスタントです。
- 体系的な調査は web_search で根拠のある情報源を優先的に探す。
- 詳細な確認やウェブ上での操作が必要な場合は computer_use_preview を用いてブラウザ上で手順を実行する。
- ブラウザは DuckDuckGo の検索ページから始まるので、必要に応じて検索クエリを入力して調査を進める。
最終回答では参照したURLとブラウザで確認した事実を簡潔にまとめてください。
`.trim(),
  model: 'gpt-5-mini',
  tools: [webSearchTool({ searchContextSize: 'medium' }), computerTool({ computer })],
});

const response = await (async () => {
  try {
    return await run(agent, request, { maxTurns: 10 });
  } finally {
    await dispose();
  }
})();

if (response.newItems.length > 0) {
  console.log('\n=== 生成されたアイテム ===\n');
  console.dir(
    response.newItems.map((item) => item.toJSON()),
    { depth: null }
  );
}

const finalOutput = response.finalOutput;
console.log('\n=== 最終結果 ===\n');
if (typeof finalOutput === 'string') {
  console.log(finalOutput);
} else if (finalOutput != null) {
  console.log(JSON.stringify(finalOutput));
} else {
  console.log('回答を生成できませんでした。');
}

// 例: さいたま市の公式サイトで最新の防災情報を確認して要点をまとめて
// 例: 2025年の日本における再生可能エネルギー投資動向を調べて、主要な統計をMarkdownの表に整理して

async function createPlaywrightComputer(): Promise<{ computer: Computer; dispose: () => Promise<void> }> {
  const viewportWidth = 1280;
  const viewportHeight = 720;
  const headlessEnv = process.env.PLAYWRIGHT_HEADLESS;
  const headless = typeof headlessEnv === 'string' ? headlessEnv.toLowerCase() !== 'false' : true;

  const browser = await chromium.launch({
    headless,
    args: ['--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://duckduckgo.com/', { waitUntil: 'networkidle' });
  // DuckDuckGo は地域固有のダイアログをほとんど表示せず、エージェントにとって予測しやすい検索画面を提供する。
  await page.mouse.move(viewportWidth / 2, viewportHeight / 2);

  const computer: Computer = {
    environment: 'browser',
    dimensions: [viewportWidth, viewportHeight],
    async screenshot() {
      const buffer = await page.screenshot({ fullPage: true, type: 'png' });
      return buffer.toString('base64');
    },
    async click(x, y, button) {
      if (button === 'back') {
        await page.goBack().catch(() => {});
        return;
      }
      if (button === 'forward') {
        await page.goForward().catch(() => {});
        return;
      }
      const mappedButton = button === 'wheel' ? 'middle' : button;
      await page.mouse.click(x, y, { button: mappedButton });
    },
    async doubleClick(x, y) {
      await page.mouse.dblclick(x, y);
    },
    async scroll(x, y, scrollX, scrollY) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(scrollX, scrollY);
    },
    async type(text) {
      await page.keyboard.type(text, { delay: 20 });
    },
    async wait() {
      await page.waitForTimeout(1000);
    },
    async move(x, y) {
      await page.mouse.move(x, y, { steps: 5 });
    },
    async keypress(keys) {
      if (keys.length === 0) return;
      const normalized = keys.map(normalizeKey);
      const modifiers = normalized.slice(0, -1);
      const lastKey = normalized.at(-1);
      if (!lastKey) {
        return;
      }

      for (const key of modifiers) {
        await page.keyboard.down(key);
      }

      await page.keyboard.press(lastKey);

      for (const key of modifiers.reverse()) {
        await page.keyboard.up(key);
      }
    },
    async drag(path) {
      if (path.length === 0) return;
      const firstPoint = path[0];
      if (!firstPoint) return;
      const [startX, startY] = firstPoint;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (const [x, y] of path.slice(1)) {
        await page.mouse.move(x, y);
      }
      await page.mouse.up();
    },
  };

  return {
    computer,
    async dispose() {
      await context.close();
      await browser.close();
    },
  };

  function normalizeKey(key: string) {
    const keyMap: Record<string, string> = {
      ALT: 'Alt',
      CONTROL: 'Control',
      CTRL: 'Control',
      SHIFT: 'Shift',
      CMD: 'Meta',
      COMMAND: 'Meta',
      META: 'Meta',
      SUPER: 'Meta',
      WIN: 'Meta',
      ENTER: 'Enter',
      RETURN: 'Enter',
      ESC: 'Escape',
      ESCAPE: 'Escape',
      BACKSPACE: 'Backspace',
      TAB: 'Tab',
      SPACE: 'Space',
      PAGEUP: 'PageUp',
      PAGEDOWN: 'PageDown',
      PGUP: 'PageUp',
      PGDN: 'PageDown',
      HOME: 'Home',
      END: 'End',
      INSERT: 'Insert',
      DELETE: 'Delete',
      DEL: 'Delete',
      ARROWUP: 'ArrowUp',
      ARROWDOWN: 'ArrowDown',
      ARROWLEFT: 'ArrowLeft',
      ARROWRIGHT: 'ArrowRight',
      UP: 'ArrowUp',
      DOWN: 'ArrowDown',
      LEFT: 'ArrowLeft',
      RIGHT: 'ArrowRight',
    };

    const upperKey = key.toUpperCase();
    if (keyMap[upperKey]) {
      return keyMap[upperKey];
    }

    if (/^F\d{1,2}$/.test(upperKey)) {
      return upperKey;
    }

    if (upperKey.length === 1) {
      return upperKey;
    }

    return upperKey.charAt(0) + upperKey.slice(1).toLowerCase();
  }
}
