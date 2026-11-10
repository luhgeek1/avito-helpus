import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
const errors=[];
try {
 const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('buddy-pet','orbit'));
 const page = await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 const widget=page.locator('.companion'), pet=page.locator('.widget-pet');await pet.waitFor();
 async function dragTo(x,y){const box=await pet.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:12});await page.mouse.up();}
 await dragTo(400,350);
 let box=await widget.boundingBox();assert(box.x<500 && box.y<400);assert.equal(await page.locator('.widget-bubble').count(),0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('buddy-position')));
 await page.reload();await pet.waitFor();box=await widget.boundingBox();assert.equal(box.x,saved.x);assert.equal(box.y,saved.y);
 await dragTo(-200,-200);box=await widget.boundingBox();assert.equal(box.x,8);assert.equal(box.y,8);
 await pet.click();let bubble=await page.locator('.widget-bubble').boundingBox();assert(bubble.x>=0 && bubble.y>=0 && bubble.x+bubble.width<=1440 && bubble.y+bubble.height<=900);
 await page.screenshot({path:'frontend/design/captures/draggable-companion-desktop.png'});
 await page.getByRole('button',{name:'Закрыть приветствие',exact:true}).click();
 await dragTo(1700,1200);box=await widget.boundingBox();assert(box.x+box.width<=1440 && box.y+box.height<=900);
 await page.setViewportSize({width:390,height:844});box=await widget.boundingBox();assert(box.x+box.width<=390 && box.y+box.height<=844);
 await pet.focus();const before=box.x;await page.keyboard.press('ArrowLeft');box=await widget.boundingBox();assert.equal(box.x,before-16);
 await page.getByRole('button',{name:'Скрыть спутника',exact:true}).click();await page.locator('.restore-buddy').click();assert.equal((await widget.boundingBox()).x,box.x);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await mobile.addInitScript(()=>localStorage.setItem('buddy-pet','orbit'));
 const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await phone.locator('.widget-pet').waitFor();
 const pb=await phone.locator('.widget-pet').boundingBox();const cdp=await mobile.newCDPSession(phone);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pb.x+pb.width/2,y:pb.y+pb.height/2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:220}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await phone.waitForTimeout(100);const moved=await phone.locator('.companion').boundingBox();assert(moved.y<300);assert.equal(await phone.locator('.widget-bubble').count(),0);
 await phone.locator('.widget-pet').tap();const mb=await phone.locator('.widget-bubble').boundingBox();assert(mb.x>=0 && mb.x+mb.width<=390 && mb.y>=0 && mb.y+mb.height<=844);
 await phone.screenshot({path:'frontend/design/captures/draggable-companion-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: mouse/touch dragging, boundary clamping, persistence, resize, keyboard, hide/restore, click vs drag, bubbles on desktop/mobile; no browser errors');
} finally {await browser.close();}
