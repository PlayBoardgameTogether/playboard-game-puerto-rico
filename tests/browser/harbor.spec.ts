import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { DeterministicRng, type Json } from '../../packages/game-sdk/src/index.js';
import { PackageRuntime } from '../../apps/api/src/registry/package-runtime.js';
import { readGamePackage } from '../../apps/api/src/catalog/game-package.js';

type FixtureState = {
  current: number;
  move: number;
  seats: string[];
  players: {
    goods: number[];
    money: number;
    city: { id: number; workers: number }[];
    island: { good: number; workers: number }[];
  }[];
  workers: number;
  buildings: number[];
  bank: number[];
  deck: number[];
  market: number[];
  discard: number[];
};

async function board(page: Page, rich = false) {
  const source = await readFile('game-packages/puerto-rico/server.txt', 'utf8');
  const version = /version:\s*'([0-9]+\.[0-9]+\.[0-9]+)'/.exec(source)?.[1];
  if (!version) throw new Error('Missing exact game version');
  const parsed = readGamePackage(await readFile(`dist/game-packages/puerto-rico-${version}.zip`));
  const game = (await PackageRuntime.create()).extension(parsed.server);
  const rng = new DeterministicRng(131);
  let state = game.setup({ seats: ['a', 'b', 'c'], options: {}, rng }).state;
  const arranged = state as unknown as FixtureState;
  const index = arranged.current;
  const seatId = arranged.seats[index]!;
  if (rich) {
    const owner = arranged.players[index]!;
    owner.money = 19;
    for (const [g, n] of [5, 4, 3, 2, 3].entries()) {
      owner.goods[g] = n;
      arranged.bank[g]! -= n;
    }
    for (const id of [0, 5, 18, 20]) {
      owner.city.push({ id, workers: 1 });
      arranged.buildings[id]!--;
      arranged.workers--;
    }
    for (const good of [0, 2, 3, 4]) {
      const pool = [arranged.deck, arranged.market, arranged.discard].find((pool) =>
        pool.includes(good),
      )!;
      pool.splice(pool.indexOf(good), 1);
      owner.island.push({ good, workers: 1 });
      arranged.workers--;
    }
    state = game.deserialize(arranged);
    state = game.applyAction(
      state,
      { kind: 'seat', seatId, controllerEpoch: 0 },
      { type: 'role', role: 5, privilege: true },
      rng,
    ).state;
  }
  const actions: Json[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const view = () => game.getView(state, { kind: 'seat', seatId });
  const publish = async (
    busy = false,
    events: unknown[] = [],
    replay?: { id: string; animate: boolean },
  ) => {
    await page.evaluate(
      (data) => {
        document.querySelector('iframe')!.contentWindow!.postMessage(data, '*');
      },
      { type: 'boardgame:view', view: view(), busy, events, ...(replay ? { replay } : {}) },
    );
  };
  let lastEvents: unknown[] = [];
  await page.exposeFunction('submitAction', async (raw: unknown) => {
    const action = game.parseAction(raw);
    actions.push(action);
    await publish(true);
    const result = game.applyAction(
      state,
      { kind: 'seat', seatId, controllerEpoch: 0 },
      action,
      rng,
    );
    state = result.state;
    lastEvents = game.projectEvents(result.events, { kind: 'seat', seatId }).map((event, i) => ({
      eventId: `fixture-${(state as unknown as FixtureState).move}-${i}`,
      event,
    }));
    await publish(false, lastEvents);
  });
  await page.route('http://harbor.test/**', async (route) => {
    if (route.request().url().endsWith('/desktop')) {
      await route.fulfill({
        contentType: 'text/html',
        body: parsed.client,
        headers: {
          'content-security-policy':
            "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'",
        },
      });
    } else
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#142d34}iframe{display:block;width:100%;border:0;min-height:700px}</style><iframe title="海港测试棋桌" sandbox="allow-scripts" src="/desktop"></iframe><script>
      const initial=${JSON.stringify(view()).replaceAll('<', '\\u003c')};
      addEventListener('message',event=>{const frame=document.querySelector('iframe');if(event.source!==frame.contentWindow)return;
      if(event.data.type==='boardgame:ready')frame.contentWindow.postMessage({type:'boardgame:view',view:initial,busy:false,events:[]},'*');
      if(event.data.type==='boardgame:resize')frame.style.height=(event.data.fit==='viewport'?Math.max(180,innerHeight-16):event.data.height)+'px';
      if(event.data.type==='boardgame:action')window.submitAction(event.data.action);});
      </script></html>`,
      });
  });
  await page.goto('http://harbor.test/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#status')).not.toContainText('等待棋桌同步');
  return {
    frame,
    actions,
    errors,
    publish,
    lastEvents: () => lastEvents,
    restore: () => {
      state = game.deserialize(game.serialize(state));
    },
  };
}

test('themed objects remain usable with keyboard, workers, dialogs and restoration', async ({
  page,
}, info) => {
  const { frame, actions, errors, publish, restore } = await board(page);
  await expect(frame.getByRole('button', { name: '确认行动', exact: true })).toBeDisabled();
  await frame.getByRole('button', { name: /^市长 ·/ }).focus();
  await page.keyboard.press('Enter');
  expect(actions).toHaveLength(0);
  await expect(frame.getByRole('button', { name: /^市长 ·/ })).toBeFocused();
  await publish(true);
  await expect(frame.locator('#confirm')).toBeDisabled();
  await publish();
  await frame.locator('#confirm').click();
  await expect(frame.locator('#status')).toContainText('安排全部工人');
  await frame.getByRole('button', { name: '清空岗位', exact: true }).click();
  await expect(frame.locator('#confirm')).toBeDisabled();
  await frame.getByRole('spinbutton', { name: /地块 1工人数/ }).fill('1');
  await expect(frame.locator('#confirm')).toBeEnabled();
  await frame.locator('#confirm').click();
  await expect.poll(() => actions.length).toBe(2);
  restore();
  await page.reload();
  await publish();
  await expect(frame.locator('#status')).toContainText('安排全部工人');
  if (info.project.name.includes('mobile'))
    await frame.getByRole('button', { name: '岛屿与城市', exact: true }).click();
  await frame
    .getByRole('button', { name: /查看.*地块详情/ })
    .first()
    .click();
  await expect(frame.getByRole('dialog')).toContainText('工人');
  await page.keyboard.press('Escape');
  await frame.getByRole('button', { name: '建筑图鉴', exact: true }).click();
  await expect(frame.locator('#building-list article')).toHaveCount(23);
  await expect(frame.getByRole('dialog')).toContainText('工厂 · 7 金币');
  await page.keyboard.press('Escape');
  await expect(frame.locator('.sprite').first()).toHaveCSS(
    'background-image',
    /^url\("data:image\/png/,
  );
  await page.screenshot({ path: info.outputPath('workers.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('cargo previews follow legal ships, commit once and suppress duplicate or reduced-motion animation', async ({
  page,
}, info) => {
  const { frame, actions, errors, publish, lastEvents } = await board(page, true);
  await expect(frame.locator('#status')).toContainText('装船获取胜利点');
  await frame.getByRole('button', { name: '选择玉米装船，库存 5 桶', exact: true }).click();
  await expect(frame.locator('#ships .target')).toHaveCount(2);
  await frame.locator('#ships [data-ship="1"]').click();
  await expect(frame.locator('#ships .preview')).toHaveCount(5);
  if (info.project.name.includes('mobile')) {
    await expect(frame.locator('#ships > #confirm-bar')).toBeVisible();
  }
  await expect(frame.locator('#draft-hint')).toContainText('未提交');
  expect(actions).toEqual([]);
  const child = page.frames().find((child) => child.url().endsWith('/desktop'))!;
  for (const theme of ['dark', 'light']) {
    await child.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    expect(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`cargo-${theme}.png`), fullPage: true });
  }
  await publish(true);
  for (const target of await frame.locator('#ships .target').all())
    await expect(target).toBeDisabled();
  await expect(frame.locator('#confirm')).toBeDisabled();
  await publish();
  await frame.locator('#confirm').click();
  await expect.poll(() => actions.length).toBe(1);
  await expect(frame.locator('#ships [data-ship="1"]')).toContainText('5 / 5');
  await expect.poll(() => child.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  await expect.poll(() => child.evaluate(() => document.getAnimations().length)).toBe(0);
  await publish(false, lastEvents());
  expect(await child.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frame.getByRole('button', { name: '选择靛蓝装船，库存 4 桶', exact: true }).click();
  await frame.locator('#ships [data-ship="0"]').click();
  await frame.locator('#confirm').click();
  await expect.poll(() => actions.length).toBe(2);
  expect(await child.evaluate(() => document.getAnimations().length)).toBe(0);
  await publish(false, [], { id: 'readonly', animate: false });
  await expect(frame.locator('#confirm')).toHaveCount(0);
  await expect(frame.locator('#goods button')).toHaveCount(0);
  expect(
    await child.evaluate(() => {
      try {
        return parent.document.cookie;
      } catch {
        return 'blocked';
      }
    }),
  ).toBe('blocked');
  expect(errors).toEqual([]);
});
