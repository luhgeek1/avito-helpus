import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('.git/codex-landing-merge/pet-manifest.json', 'utf8'));
for (const [file, expected] of Object.entries(manifest)) {
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected, `Protected file changed: ${file}`);
}
const browser = await chromium.launch();
const reports = [], errors = [];
const routes = [
  ['/', /Привет, Даниил/], ['/services', 'Все сервисы'], ['/services/booking', /Букинг/],
  ['/events', 'События'], ['/feed', 'Лента'], ['/feed/post-1', /Первая неделя/],
  ['/benefits/savings', 'Выгода'], ['/profile', /Орлов Даниил/], ['/people/p-olga', 'Миронова Ольга'],
  ['/ai', 'Искусственный интеллект в Авито'], ['/search?q=Даниил', /Результаты по запросу/],
];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem("buddy-onboarding-v1", "done");
      if (localStorage.getItem('merge-test')) return;
      localStorage.setItem('merge-test', 'true');
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
      localStorage.setItem('hub-preferences', JSON.stringify({ state: { quickActionIds: ['qa-events', 'qa-booking', 'qa-vacation', 'qa-trip', 'qa-tasks', 'qa-access'], feedbackHidden: true, feedbackAnswered: false }, version: 0 }));
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    for (const [route, heading] of routes) {
      await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
      await (route === '/profile' || route.startsWith('/people/') ? page.getByText(heading, { exact: true }) : page.getByRole('heading', { name: heading, exact: typeof heading === 'string' })).first().waitFor();
      await page.locator('.widget-pet').waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${route}`);
      const saved = await page.evaluate(() => ({ pet: localStorage.getItem('buddy-pet'), favorites: JSON.parse(localStorage.getItem('buddy-favorites')) }));
      assert.equal(saved.pet, 'orbit'); assert.deepEqual(saved.favorites, ['orbit', 'orbi-neo']);
      if (width !== 320 && !route.startsWith('/search')) {
        const name = route === '/' ? 'home' : route.replaceAll('/', '-').slice(1);
        await page.screenshot({ path: `frontend/design/captures/merge-page-${name}-${width}.png`, fullPage: true });
      }
    }
    await page.locator('header').getByRole('link', { name: 'Сервисы', exact: true }).click();
    await page.waitForURL('**/services');
    const pet = page.locator('.widget-pet'), originalPet = await pet.elementHandle();
    await page.locator('header').getByRole('link', { name: 'События', exact: true }).click();
    await page.waitForURL('**/events');
    assert(await originalPet.evaluate(element => element.isConnected), 'Pet remounted during portal navigation');
    await page.getByRole('group', { name: 'Категории', exact: true }).getByRole('button', { name: /Спорт/ }).click();
    await page.waitForURL('**/events?category=sport');
    await page.locator('header').getByRole('searchbox', { name: 'Поиск по порталу' }).fill('Даниил');
    await page.locator('header').getByRole('searchbox', { name: 'Поиск по порталу' }).press('Enter');
    await page.waitForURL('**/search?q=*');
    await page.getByRole('heading', { name: /Результаты по запросу/ }).waitFor();
    await pet.focus(); await page.waitForTimeout(400);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    const spotlight = page.locator('.companion-spotlight'); await spotlight.waitFor();
    const input = page.getByRole('textbox', { name: 'Запрос для пета' });
    await input.fill('Спасибо'); await input.press('Enter');
    await page.locator('.pixel-dialogue').waitFor();
    assert.match(await page.locator('.dialogue-accessible').textContent(), /Всегда рядом/);
    assert.equal(await spotlight.getByRole('status').count(), 0);
    assert.equal((await spotlight.boundingBox()).height, 56);
    const skip = page.getByRole('button', { name: 'Показать сразу', exact: true });
    if (await skip.count()) await skip.click();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await pet.focus(); await page.waitForTimeout(400); await pet.press('Space');
    await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#companion-wardrobe').inert);
    const wardrobe = page.locator('#companion-wardrobe');
    await wardrobe.press('ArrowRight'); await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Выбрать персонажа Нео', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('buddy-pet') === 'orbi-neo');
    await page.goto('http://localhost:5173/pets?pet=orbit', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Орби', exact: true }).first().waitFor();
    assert.equal(await page.locator('.pet-card').count(), 16);
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-pet')), 'orbi-neo');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    if (width !== 320) await page.screenshot({ path: `frontend/design/captures/merge-pets-${width}.png`, fullPage: true });
    reports.push({ width, routes: routes.length, noOverflow: true, clientNavigation: true, queryFilters: true,
      search: true, petMountPreserved: true, spotlight: true, pixelReply: true, wardrobeSelection: true,
      gallery: true, savedChoiceAndFavorites: true });
    await context.close();
    console.log(`PASS merged portal and companion ${width}`);
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/landing-main-merge-verification.json', JSON.stringify({ protectedFiles: manifest, protectedFilesUnchanged: true, reports, errors }, null, 2));
} finally { await browser.close(); }
