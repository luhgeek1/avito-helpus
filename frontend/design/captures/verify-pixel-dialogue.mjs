import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  const context=await browser.newContext({viewport});
  await context.addInitScript(()=>localStorage.setItem('buddy-pet','orbit'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});
  const pet=page.locator('.widget-pet'), panel=page.locator('.pixel-dialogue'), typed=page.locator('.dialogue-typed');
  await pet.dblclick();await panel.waitFor();
  const whole=await page.locator('.dialogue-reserve').textContent();
  await page.waitForTimeout(250);let partial=await typed.textContent();assert(partial.length>0&&partial.length<whole.length);
  assert(await page.locator('.companion').evaluate(e=>e.classList.contains('is-talking')));
  await page.waitForFunction((length)=>document.querySelector(".dialogue-typed").textContent.length>length,partial.length);
  const box=await panel.boundingBox(), anchor=await page.locator('.companion').boundingBox();
  assert(box.x+box.width<=anchor.x-8,'Dialogue must be left of companion');
  assert(box.x>=0&&box.y>=0&&box.y+box.height<=viewport.height);
  await page.screenshot({path:`frontend/design/captures/pixel-dialogue-${viewport.width}-typing.png`});
  await page.getByRole('button',{name:'Показать сразу'}).click();assert.equal(await typed.textContent(),whole);
  await page.waitForTimeout(350);assert.equal(await typed.textContent(),whole,'Skipped text must remain complete');
  assert(!(await page.locator('.companion').evaluate(e=>e.classList.contains('is-talking'))));
  await page.screenshot({path:`frontend/design/captures/pixel-dialogue-${viewport.width}.png`});
  await page.getByRole('button',{name:'Закрыть приветствие',exact:true}).click();await pet.dblclick();await page.waitForTimeout(250);assert((await typed.textContent()).length<whole.length,'Reopen restarts typing');
  await page.getByRole('button',{name:'Закрыть приветствие',exact:true}).click();
  let b=await pet.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(20,100,{steps:8});await page.mouse.up();
  assert.equal(await panel.count(),0,'Dragging must not open dialogue');await pet.dblclick();
  b=await panel.boundingBox();assert(b.x>=0&&b.x+b.width<=viewport.width&&b.y>=0&&b.y+b.height<=viewport.height,'Edge placement');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await typed.textContent(),whole);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS desktop/mobile: left placement, progressive text, skip, restart, talk animation, edge fallback, drag distinction, reduced motion; no browser errors');
} finally {await browser.close();}
