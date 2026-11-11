import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch();const errors=[],results=[];
try {
 for(const width of [1440,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<650});
  await context.addInitScript(()=>{
   localStorage.setItem('buddy-pet','orbit');
   const compact=innerWidth<=650;
   localStorage.setItem('buddy-position',JSON.stringify({x:innerWidth-(compact?154:185),y:innerHeight-(compact?108:148)}));
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});
  const pet=page.locator('.widget-pet'), menu=page.locator('.companion-orbit-menu');
  await pet.click();assert.equal(await pet.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.pixel-dialogue').count(),0);
  await page.waitForFunction(()=>document.querySelectorAll('.orbit-action').length===3);
  await page.reload({waitUntil:'networkidle'});await pet.click();await page.waitForFunction(()=>document.querySelectorAll('.orbit-action').length===3);
  await page.waitForTimeout(400);
  assert.equal(await menu.getAttribute('aria-hidden'),'false');
  const boxes=await page.locator('.orbit-action').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
  for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=900);assert(b.w>=47.9,JSON.stringify(b));}
  assert(boxes[0].x<boxes[1].x&&boxes[1].x<boxes[2].x);assert(boxes[0].y>boxes[1].y&&boxes[1].y>boxes[2].y);
  await page.screenshot({path:`frontend/design/captures/orbit-menu-${width}.png`});
  await pet.focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Чат');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('dialog',{name:'Настройки спутника'}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Закрыть настройки');
  const toggle=page.getByRole('switch');await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');await toggle.click();
  await page.keyboard.press('Escape');assert.equal(await page.locator('.companion-settings').count(),0);
  await page.waitForTimeout(400);await pet.dblclick();await page.locator('.pixel-dialogue').waitFor();assert.equal(await pet.getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Закрыть приветствие',exact:true}).click();await pet.focus();
  await page.keyboard.press('Enter');assert.equal(await pet.getAttribute('aria-expanded'),'true');await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Запрос к Орби'}).waitFor();
  await page.keyboard.press('Escape');await page.waitForTimeout(400);await pet.click();await page.getByRole('button',{name:'Гардероб',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#companion-wardrobe')?.matches(':not([inert])'));await page.keyboard.press('Escape');
  await page.waitForTimeout(400);await pet.click();await page.getByRole('button',{name:'Чат',exact:true}).click();await page.locator('.companion-chat').waitFor();await page.keyboard.press('Escape');
  let b=await pet.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(15,80,{steps:10});await page.mouse.up();assert.equal(await pet.getAttribute('aria-expanded'),'false');
  await page.waitForTimeout(400);await pet.click();await page.waitForTimeout(400);
  for(const b of await page.locator('.orbit-action').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})))assert(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=900);
  await page.screenshot({path:`frontend/design/captures/orbit-menu-edge-${width}.png`});
  await page.mouse.click(width-10,400);assert.equal(await pet.getAttribute('aria-expanded'),'false');
  if(width<650){await page.waitForTimeout(400);await pet.tap();assert.equal(await pet.getAttribute('aria-expanded'),'true');await page.waitForTimeout(80);await pet.tap();await page.locator('.pixel-dialogue').waitFor();await page.keyboard.press('Escape');}
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(400);await pet.click();assert.equal(await page.locator('.orbit-action').first().evaluate(e=>getComputedStyle(e).transitionProperty),'none');
  results.push({width,restoredPosition:true,reload:true,buttons:3,arc:true,singleClick:true,doubleClick:true,doubleEnter:true,actions:true,drag:true,edgePlacement:true,reducedMotion:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('frontend/design/captures/orbit-menu-verification.json',JSON.stringify({results,errors},null,2));console.log('PASS orbit menu: single/double click, double Enter, actions, drag, edge bounds, reduced motion, desktop/mobile');
}finally{await browser.close();}
