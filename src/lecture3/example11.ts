/**
 * Computer Useを使ったエージェントの例。
 */

import type { Computer } from '@openai/agents';

type ComputerButton = Parameters<Computer['click']>[2];
type DragPath = Parameters<Computer['drag']>[0];

import { Agent, computerTool, run } from '@openai/agents';
import { chromium } from 'playwright';

process.env.OPENAI_API_KEY ||= '<ここにOpenAIのAPIキーを貼り付けてください>';

const { computer, dispose } = await createPlaywrightComputer();

const agent = new Agent({
  name: 'Browser researcher',
  instructions: 'あなたはブラウザ操作を行うアシスタントです。ユーザーの指示に従って、ウェブページを操作してください。',
  model: 'computer-use-preview',
  modelSettings: {
    truncation: 'auto',
  },
  tools: [computerTool({ computer })],
});

const response = await (async () => {
  try {
    console.log('[agent] Starting run with computer tool...');
    return await run(agent, '新宿駅の周辺にある焼肉屋で明日19時から4名で予約できるお店を探して、予約画面を表示して。', {
      maxTurns: 10,
    });
  } finally {
    console.log('[browser] Cleaning up browser resources...');
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
const itemTypes = response.newItems.map((item) => item.type);
console.log('[agent] Run completed.', {
  newItems: response.newItems.length,
  itemTypes,
  hasFinalOutput: finalOutput != null,
});
console.log('\n=== 最終結果 ===\n');
if (typeof finalOutput === 'string') {
  console.log(finalOutput);
} else if (finalOutput != null) {
  console.log(JSON.stringify(finalOutput));
} else {
  console.log('回答を生成できませんでした。');
}

// 例: 新宿駅の周辺にある焼肉屋で明日19時から4名で予約できるお店を探して、予約画面を表示して。

async function createPlaywrightComputer(): Promise<{ computer: Computer; dispose: () => Promise<void> }> {
  const viewportWidth = 1280;
  const viewportHeight = 720;

  console.log('[browser] Launching Chromium with viewport configuration', {
    viewportWidth,
    viewportHeight,
  });
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });
  const page = await context.newPage();

  await page.goto('https://www.hotpepper.jp/');
  console.log('[browser] Navigated to HotPepper landing page');

  // The Computer type's index signature currently rejects literal environment keys, so we assert after constructing the full object.
  const computer: Computer = {
    environment: 'browser',
    dimensions: [viewportWidth, viewportHeight],
    async screenshot() {
      console.log('[computer] Taking screenshot');
      const buffer = await page.screenshot({ fullPage: true, type: 'png' });
      return buffer.toString('base64');
    },
    async click(x: number, y: number, button: ComputerButton) {
      console.log('[computer] Click action', { x, y, button });
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
    async doubleClick(x: number, y: number) {
      console.log('[computer] Double click action', { x, y });
      await page.mouse.dblclick(x, y);
    },
    async scroll(x: number, y: number, scrollX: number, scrollY: number) {
      console.log('[computer] Scroll action', { x, y, scrollX, scrollY });
      await page.mouse.move(x, y);
      await page.mouse.wheel(scrollX, scrollY);
    },
    async type(text: string) {
      console.log('[computer] Type action', { characters: text.length });
      await page.keyboard.type(text, { delay: 20 });
    },
    async wait() {
      console.log('[computer] Wait action (1s)');
      await page.waitForTimeout(1000);
    },
    async move(x: number, y: number) {
      console.log('[computer] Move action', { x, y });
      await page.mouse.move(x, y, { steps: 5 });
    },
    async keypress(keys: string[]) {
      if (keys.length === 0) return;
      const normalized = keys.map(normalizeKey);
      const modifiers = normalized.slice(0, -1);
      const lastKey = normalized.at(-1);
      if (!lastKey) {
        return;
      }
      console.log('[computer] Keypress action', { modifiers, key: lastKey });

      for (const key of modifiers) {
        await page.keyboard.down(key);
      }

      await page.keyboard.press(lastKey);

      for (const key of modifiers.reverse()) {
        await page.keyboard.up(key);
      }
    },
    async drag(path: DragPath) {
      if (path.length === 0) return;
      const firstPoint = path[0];
      if (!firstPoint) return;
      const [startX, startY] = firstPoint;
      console.log('[computer] Drag action', { start: { x: startX, y: startY }, steps: path.length });
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (const [x, y] of path.slice(1)) {
        await page.mouse.move(x, y);
      }
      await page.mouse.up();
    },
  };

  return {
    computer: computer as Computer,
    async dispose() {
      console.log('[computer] Disposing computer session');
      console.log('[browser] Closing context and browser');
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
