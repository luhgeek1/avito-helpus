import{chromium}from'/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';
const b=await chromium.launch();const reports=[],errors=[];
try{for(const[width,height]of[[1440,900],[390,844],[320,568]]){
 const p=await b.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.PET_TEST_URL??'http://localhost:5175/',{waitUntil:'networkidle'});const tour=p.locator('.companion-tour');await tour.waitFor();
 for(let i=0;i<2;i++){await tour.focus();await p.keyboard.press('Space');await p.waitForTimeout(350);}await p.waitForTimeout(800);
 if(width>1000){const right=await p.locator('.wardrobe-pet[aria-hidden=false]').evaluateAll(es=>Math.max(...es.map(e=>e.getBoundingClientRect().right)));const text=await p.locator('.tour-copy').boundingBox();const gap=text.x-right;assert(gap>24&&gap<90,`Text gap ${gap}`);}
 await p.screenshot({path:`frontend/design/captures/onboarding-closer-text-${width}.png`});
 for(let i=0;i<3;i++){await tour.focus();await p.keyboard.press('Space');await p.waitForTimeout(350);}await p.waitForTimeout(800);
 assert.equal(await tour.getAttribute('data-tour-scene'),'move');
 await p.evaluate(()=>{window.exitFrames=[];let done=0;const frame=()=>{const b=document.querySelector('.widget-pet .pixel-pet').getBoundingClientRect();window.exitFrames.push({x:b.x,y:b.y,w:b.width,h:b.height});if(!document.querySelector('.companion-tour'))done++;if(done<5)requestAnimationFrame(frame);};requestAnimationFrame(frame);});
 await tour.focus();await p.keyboard.press('Space');await p.waitForTimeout(250);assert(await tour.isVisible(),'Keep tour open during exit');
 await p.screenshot({path:`frontend/design/captures/onboarding-exit-midpoint-${width}.png`});await tour.waitFor({state:'detached'});await p.waitForTimeout(150);
 const frames=await p.evaluate(()=>window.exitFrames),size=width>650?128:96;
 assert(frames.some(f=>f.w>size+5&&f.w<(width>650?384:192)-5),'Missing scale interpolation');
 const final=frames.at(-1);assert(Math.abs(final.w-size)<1);assert(Math.abs(final.x-(width-(width>650?169:130)))<1);assert(Math.abs(final.y-(height-(width>650?148:108)))<1);
 assert(frames.slice(-4).every(f=>Math.abs(f.x-final.x)<1&&Math.abs(f.w-size)<1),'Landing jumps');
 reports.push({width,height,smoothShrink:true,cornerLanding:true,stableFinalFrames:true,frames:frames.length});await p.close();console.log('PASS animated tour exit',width);
}
const p=await b.newPage({reducedMotion:'reduce'});await p.goto('http://localhost:5175/',{waitUntil:'networkidle'});await p.locator('.companion-tour').waitFor();await p.getByRole('button',{name:'Пропустить',exact:true}).click();await p.locator('.companion-tour').waitFor({state:'detached'});assert.equal((await p.locator('.widget-pet .pixel-pet').boundingBox()).width,128);await p.close();assert.deepEqual(errors,[]);await writeFile('frontend/design/captures/onboarding-exit-verification.json',JSON.stringify({reports,reducedMotion:true,errors},null,2));
}finally{await b.close();}
