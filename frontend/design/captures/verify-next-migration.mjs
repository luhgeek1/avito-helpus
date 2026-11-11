import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const errors=[],results=[];
try {
 for(const width of [1440,1366,850,650,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});
  await context.addInitScript(()=>{
   if(!localStorage.getItem('migration-seeded')){
    localStorage.setItem('buddy-pet','orbit');localStorage.setItem('buddy-favorites','["orbit"]');
    localStorage.setItem('migration-seeded','true');
   }
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const response=await page.goto('http://localhost:5173/pets?pet=orbit',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);await page.locator('.companion').waitFor();
  assert.match(await page.title(),/Галерея петов/);assert.equal(await page.locator('.pet-card').count(),16);
  assert.match(await page.locator('.detail-name h2').textContent(),/Орби/);
  assert.equal(await page.locator('.pet-detail .pixel-pet').getAttribute('viewBox'),'0 0 32 32');
  assert.equal(await page.locator('.pet-card').first().locator('.sprite-frame').evaluateAll(es=>es.filter(e=>getComputedStyle(e).opacity==='1').length),1);
  await page.getByRole('button',{name:'Избранные · 1',exact:true}).click();assert.equal(await page.locator('.pet-card').count(),1);
  await page.getByRole('button',{name:'Убрать из избранного: Орби',exact:true}).first().click();await page.locator('.collection-empty').waitFor();
  await page.getByRole('button',{name:'Все · 40',exact:true}).click();assert.equal(await page.locator('.pet-card').count(),40);
  await page.getByRole('button',{name:'Раньше · 25',exact:true}).click();assert.equal(await page.locator('.pet-card').count(),25);
  await page.getByRole('button',{name:'Орби · 16',exact:true}).click();
  await page.getByRole('button',{name:'В избранное: Орби',exact:true}).first().click();
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Избранные · 1',exact:true}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать спрайт: Орби',exact:true}).click();
  const download=await downloadPromise;assert.match(await readFile(await download.path(),'utf8'),/viewBox="0 0 32 32"/);
  await page.getByRole('button',{name:'Рассмотреть: Неоновый разведчик Нео',exact:true}).click();
  assert.equal(await page.locator('.pet-detail .pixel-pet').getAttribute('viewBox'),'0 0 64 64');
  await page.getByRole('button',{name:'Выбрать бадди',exact:true}).click();assert.match(await page.locator('.dialogue-name').textContent(),/Нео/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('buddy-pet')),'orbi-neo');
  await page.getByRole('button',{name:'Закрыть приветствие',exact:true}).click();
  await page.getByRole('button',{name:'Приостановить анимацию',exact:true}).click();assert(await page.locator('.pixel-pet').first().evaluate(e=>e.classList.contains('is-paused')));
  await page.getByRole('button',{name:'Включить анимацию',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
  await page.screenshot({path:`frontend/design/captures/next-tailwind-gallery-${width}.png`});
  await page.getByRole('link',{name:'Главная',exact:true}).click();await page.waitForURL('http://localhost:5173/');
  await page.waitForFunction(()=>document.title.includes("Главная"));await page.getByRole('heading',{name:'Интерфейс делается...'}).waitFor();
  await page.screenshot({path:`frontend/design/captures/next-tailwind-home-${width}.png`});
  await page.getByRole('link',{name:'В галерею петов',exact:true}).click();await page.waitForURL('**/pets');
  await page.goBack();await page.waitForURL('http://localhost:5173/');await page.goForward();await page.waitForURL('**/pets');
  results.push({width,directRoutes:true,filters:[16,25,40],favoritesPersist:true,selectionPersist:true,svg:true,sprites:[32,64],navigation:true,noOverflow:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('frontend/design/captures/next-tailwind-verification.json',JSON.stringify({results,errors},null,2));
 console.log('PASS Next.js/Tailwind: routes, metadata, hydration, 6 widths, favorites, selection, sprite frames, SVG export, pause, navigation and no overflow/browser errors.');
}finally{await browser.close();}
