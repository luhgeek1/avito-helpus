import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch();const results=[],errors=[];
try {
 for(const width of [1440,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<650,reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   if(localStorage.getItem('wardrobe-test'))return;
   localStorage.setItem('wardrobe-test','true');localStorage.setItem('buddy-pet','orbit');
   localStorage.setItem('buddy-favorites','["orbit","orbi-neo"]');
   localStorage.setItem('buddy-position',JSON.stringify({x:innerWidth-(innerWidth<=650?154:185),y:innerHeight-(innerWidth<=650?108:148)}));
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});
  const trigger=page.locator('.widget-pet'), wardrobe=page.locator('#companion-wardrobe');
  const center=()=>page.locator('.wardrobe-pet[data-center=true]').getAttribute('data-pet-id');
  const next=page.getByRole('button',{name:'Следующий персонаж',exact:true});
  const previous=page.getByRole('button',{name:'Предыдущий персонаж',exact:true});
  async function open(){await trigger.click();await page.getByRole('button',{name:'Гардероб',exact:true}).click();await next.waitFor();}
  async function waitChanged(before){await page.waitForFunction(id=>document.querySelector('.wardrobe-pet[data-center=true]')?.getAttribute('data-pet-id')!==id,before);}
  async function checkBounds(){
   const boxes=await page.locator('.wardrobe-pet[aria-hidden=false]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
   assert.equal(boxes.length,5);for(const b of boxes)assert(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=900,JSON.stringify(b));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await open();assert.equal(page.url(),'http://localhost:5173/');assert.equal(await center(),'orbit');await checkBounds();
  await page.screenshot({path:`frontend/design/captures/wardrobe-carousel-${width}.png`});
  const seen=new Set();for(let i=0;i<40;i++){const id=await center();seen.add(id);await next.click();await waitChanged(id);}
  assert.equal(seen.size,40);assert.equal(await center(),'orbit');assert.equal(await page.evaluate(()=>localStorage.getItem('buddy-pet')),'orbit');
  await previous.click();await waitChanged('orbit');const last=await center();await next.click();await waitChanged(last);assert.equal(await center(),'orbit');
  let id=await center();let box=await page.locator('.wardrobe-pet[data-center=true]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,90);await waitChanged(id);
  id=await center();await page.mouse.wheel(0,90);await waitChanged(id);
  id=await center();await next.focus();await page.keyboard.press('ArrowRight');await waitChanged(id);await page.keyboard.press('ArrowLeft');await page.waitForFunction(id=>document.querySelector('.wardrobe-pet[data-center=true]')?.getAttribute('data-pet-id')===id,id);
  if(width<650){
   id=await center();box=await page.locator('.wardrobe-pet[data-center=true]').boundingBox();const cdp=await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2-65,y:box.y+box.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitChanged(id);
   assert.equal(await page.evaluate(()=>localStorage.getItem('buddy-pet')),'orbit');
  }
  const selected=await center();assert.notEqual(selected,'orbit');await page.locator('.wardrobe-pet[data-center=true]').click();
  await page.waitForFunction(()=>document.querySelector('#companion-wardrobe')?.getAttribute('aria-hidden')==='true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('buddy-pet')),selected);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('buddy-favorites'))),['orbit','orbi-neo']);
  await page.reload({waitUntil:'networkidle'});await open();assert.equal(await center(),selected);await page.keyboard.press('Escape');
  assert.equal(await wardrobe.getAttribute('aria-hidden'),'true');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await open();await trigger.click();assert.equal(await wardrobe.getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.companion-orbit-menu').getAttribute('aria-hidden'),'false');await page.keyboard.press('Escape');
  box=await trigger.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(15,60,{steps:8});await page.mouse.up();await open();await checkBounds();
  await page.screenshot({path:`frontend/design/captures/wardrobe-carousel-edge-${width}.png`});
  await page.mouse.click(width-10,400);assert.equal(await wardrobe.getAttribute('aria-hidden'),'true');
  results.push({width,visible:5,total:seen.size,wrapBothDirections:true,wheel:true,keyboard:true,swipe:width<650,clickSelection:true,persistence:true,favoritesPreserved:true,edgeBounds:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('frontend/design/captures/wardrobe-verification.json',JSON.stringify({results,errors},null,2));
 console.log('PASS wardrobe: 40-pet wrap, five previews, wheel, touch swipe, keyboard, selection/persistence, favorites, bounds, Escape and return to menu');
}finally{await browser.close();}
