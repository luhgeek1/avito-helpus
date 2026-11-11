import{chromium}from'/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';
const baseURL=process.env.PET_TEST_URL??'http://localhost:5175';
const b=await chromium.launch();const reports=[],errors=[];
try{for(const[width,height]of[[1440,900],[390,844],[320,568]]){
 const p=await b.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL,{waitUntil:'networkidle'});const tour=p.locator('.companion-tour');await tour.waitFor();await p.waitForTimeout(900);
 const pet=p.locator('.widget-pet'),svg=pet.locator('svg');assert.equal((await svg.boundingBox()).width,width>650?384:192);
 if(width===1440){await p.waitForTimeout(7000);assert.equal(await tour.getAttribute('data-tour-scene'),'intro','Tour must wait for the user');}
 await p.screenshot({path:`frontend/design/captures/onboarding-large-intro-${width}.png`});
 for(const[index,scene]of['menu','wardrobe','settings','spotlight','move'].entries()){
  if(index%2===0)await p.mouse.click(width-8,height-8);else{await tour.focus();await p.keyboard.press('Space');}
  await p.waitForTimeout(1100);assert.equal(await tour.getAttribute('data-tour-scene'),scene);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(scene==='wardrobe'){
   assert.equal(await p.locator('.wardrobe-pet[aria-hidden=false]').count(),7);
   assert.match(await p.locator('.tour-copy').evaluate(e=>getComputedStyle(e).fontFamily),/pixel|press/i);
   await p.locator('#companion-wardrobe').press('ArrowRight');await p.waitForTimeout(800);assert.equal(await tour.getAttribute('data-tour-scene'),'wardrobe');
   const ys=await p.locator('.wardrobe-pet[aria-hidden=false]').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().y)));assert(new Set(ys).size>=3,'Keep circular layout');
   await p.waitForTimeout(2000);
  }
  if(scene==='spotlight'){
   if(width>650){await tour.focus();await p.keyboard.press('Enter');await p.keyboard.press('Enter');}
   const input=p.getByRole('textbox',{name:'Запрос для пета'});await input.waitFor();await input.fill('Привет');await input.press('Space');assert.equal(await input.inputValue(),'Привет ');assert.equal(await tour.getAttribute('data-tour-scene'),'spotlight');
  }
  if(scene==='move') await pet.press('ArrowRight');
  await p.screenshot({path:`frontend/design/captures/onboarding-large-${scene}-${width}.png`});
 }
 await tour.focus();await p.keyboard.press('Space');await tour.waitFor({state:'detached'});await p.waitForTimeout(300);assert.equal((await svg.boundingBox()).width,width>650?128:96);
 await pet.click();await p.waitForTimeout(400);assert.equal((await p.locator('.orbit-action').first().boundingBox()).width,width>650?52:48);
 assert.equal(await p.evaluate(()=>localStorage.getItem('buddy-onboarding-v1')),'done');
 await p.reload({waitUntil:'networkidle'});assert.equal(await tour.count(),0);reports.push({width,height,largePet:true,clickAndSpace:true,noAutomaticAdvance:true,inputSpacePreserved:true,circularWardrobe:true,normalSizeRestored:true});await p.close();console.log('PASS large manual tour',width);
}
const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await p.goto(baseURL,{waitUntil:'networkidle'});await p.locator('.companion-tour').waitFor();assert.equal(await p.locator('.widget-pet .sprite-frame').first().evaluate(e=>getComputedStyle(e).animationName),'none');await p.getByRole('button',{name:'Пропустить',exact:true}).click();await p.locator('.companion-tour').waitFor({state:'detached'});await p.close();assert.deepEqual(errors,[]);await writeFile('frontend/design/captures/onboarding-large-verification.json',JSON.stringify({reports,reducedMotion:true,errors},null,2));
}finally{await b.close();}
