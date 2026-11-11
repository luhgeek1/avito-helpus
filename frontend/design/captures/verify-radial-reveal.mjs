import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile, rename } from 'node:fs/promises';

const browser = await chromium.launch();
const reports = [], errors = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650,
      ...(width === 320 ? {} : { recordVideo: { dir: 'frontend/design/captures', size: { width, height: 900 } } }) });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet'), menu = page.locator('#companion-actions'), wardrobe = page.locator('#companion-wardrobe');
    async function capture(kind, suffix = '') {
      await page.evaluate(kind => {
        window.revealResult = null;
        const trigger = kind === 'actions' ? '.widget-pet' : '[aria-label="Гардероб"]';
        const selector = kind === 'actions' ? '.orbit-action' : '.radial-reveal';
        const begin = event => {
          if (!event.target.closest(trigger)) return;
          document.removeEventListener('click', begin, true);
          const transitions = [];
          const onTransition = event => {
            if (!event.target.matches(selector) || event.propertyName !== 'transform') return;
            const button = event.target.closest('button');
            transitions.push({ type: event.type, elapsed: event.elapsedTime,
              center: button.dataset.center === 'true', visible: +getComputedStyle(button).opacity > .05 });
          };
          document.addEventListener('transitionend', onTransition, true);
          document.addEventListener('transitioncancel', onTransition, true);
          setTimeout(() => {
            document.removeEventListener('transitionend', onTransition, true);
            document.removeEventListener('transitioncancel', onTransition, true);
            window.revealResult = transitions;
          }, 450);
        };
        document.addEventListener('click', begin, true);
      }, kind);
      if (kind === 'actions') { await page.waitForTimeout(400); await pet.click(); }
      else await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
      await page.waitForTimeout(80);
      if (kind === 'wardrobe') {
        assert.equal(await wardrobe.locator('.sprite-frame').first().evaluate(element => getComputedStyle(element).animationName), 'none');
        assert.equal(await wardrobe.locator('.frame-0').first().evaluate(element => getComputedStyle(element).opacity), '1');
      }
      if (!suffix && width !== 320) await page.screenshot({ path: `frontend/design/captures/radial-${kind}-opening-${width}.png` });
      await page.waitForFunction(() => window.revealResult !== null);
      const transitions = await page.evaluate(() => window.revealResult);
      assert.equal(transitions.filter(event => event.type === 'transitioncancel' && event.visible).length, 0, JSON.stringify(transitions));
      const finished = transitions.filter(event => event.type === 'transitionend' && event.visible && event.elapsed >= .239);
      assert(finished.length >= (kind === 'actions' ? 3 : 5), JSON.stringify(transitions));
      if (kind === 'wardrobe') assert(finished.some(event => event.center));
      const root = kind === 'actions' ? menu : wardrobe;
      assert.equal(await root.getAttribute('inert'), null);
      assert((await root.locator('.orbit-disc, .wardrobe-disc').evaluateAll(elements => elements.map(element => getComputedStyle(element).filter))).every(filter => filter === 'none'));
      if (!suffix) await page.screenshot({ path: `frontend/design/captures/radial-${kind}-${width}.png` });
      return { finished: finished.length, visibleCancellations: 0 };
    }
    const actions = await capture('actions');
    const firstWardrobe = await capture('wardrobe');
    assert.equal(await wardrobe.locator('.sprite-frame').first().evaluate(element => getComputedStyle(element).animationName), 'sprite-frame');
    await page.getByRole('button', { name: 'Выбрать персонажа Мятт', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('buddy-pet') === 'orbi-mint');
    await capture('actions', 'after-selection');
    const selectedWardrobe = await capture('wardrobe', 'after-selection');
    assert.equal(await wardrobe.locator('[data-center=true]').getAttribute('data-pet-id'), 'orbi-mint');
    await page.keyboard.press('Escape');
    await pet.focus();
    for (let i = 0; i < 3; i++) {
      await pet.press('Space'); await page.waitForTimeout(50); await page.keyboard.press('Escape'); await page.waitForTimeout(40);
    }
    await pet.press('Space'); await page.waitForFunction(() => !document.querySelector('#companion-actions').inert);
    await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
    await page.waitForTimeout(80);
    const box = await pet.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 90);
    await page.waitForTimeout(1100);
    assert.equal(await wardrobe.locator('[data-center=true]').getAttribute('data-pet-id'), 'orbi-plum');
    assert.equal(await wardrobe.getAttribute('inert'), null);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400); await pet.click(); await page.waitForFunction(() => !document.querySelector('#companion-actions').inert);
    assert.equal(await menu.locator('button').first().evaluate(element => getComputedStyle(element).transitionProperty), 'none');
    await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#companion-wardrobe').inert);
    assert.equal(await wardrobe.locator('.radial-reveal').first().evaluate(element => getComputedStyle(element).transitionProperty), 'none');
    assert.equal(await wardrobe.locator('.sprite-frame').first().evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    const video = page.video();
    await context.close();
    if (video) await rename(await video.path(), `frontend/design/captures/radial-smooth-${width}.webm`);
    reports.push({ width, actions, firstWardrobe, selectedWardrobe, idleAfterReveal: true,
      rapidReversal: true, wheelDuringReveal: true, reducedMotion: true, favoritesPreserved: true });
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/radial-reveal-verification.json', JSON.stringify({ reports, errors }, null, 2));
  console.log('PASS radial reveal: complete transitions, no visible cancellations, selected pet, rapid reversal, early wheel, reduced motion');
} finally { await browser.close(); }
