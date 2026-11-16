"""Build the editable Orbi deck from the local HTML layout.

Run from the repository root: python docs/presentation/build_pptx.py
Requires python-pptx, Pillow, Node.js and the existing frontend Playwright.
No network requests, font embedding, source edits or slide rasterization.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_AUTO_SIZE, MSO_ANCHOR, PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Pt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUTPUT = HERE / "orbi-presentation.pptx"
FONT_SCALE = 0.90
TABLE_FONT_SCALE = 0.84

# Chromium resolves CSS, local fonts, SVG instances and overflow clipping.
# Only geometry and editable content leave the browser; never slide bitmaps.
EXTRACT_JS = r"""
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2], output = process.argv[3];
const {chromium} = createRequire(path.join(root,'frontend/package.json'))('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}, reducedMotion:'reduce'});
 await page.route('**/*',r=>/^(file:|data:|about:)/.test(r.request().url())?r.continue():r.abort());
 await page.goto(pathToFileURL(path.join(root,'docs/presentation/slides.html')).href);
 await page.emulateMedia({media:'print'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 const result=await page.evaluate(()=>{
 const num=x=>parseFloat(x)||0;
 const style=e=>{const s=getComputedStyle(e);return {font:s.fontFamily.includes('Press Start')?'Press Start 2P':'Golos Text',size:num(s.fontSize),weight:num(s.fontWeight),color:s.color,line:num(s.lineHeight)||num(s.fontSize)*1.2,align:s.textAlign,spacing:num(s.letterSpacing),bg:s.backgroundColor,pad:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(num),borders:['Top','Right','Bottom','Left'].map(k=>({width:num(s['border'+k+'Width']),color:s['border'+k+'Color'],style:s['border'+k+'Style']})),radius:num(s.borderTopLeftRadius),mb:num(s.marginBottom)};};
 return [...document.querySelectorAll('section.slide')].map(slide=>{
 const sr=slide.getBoundingClientRect();
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x-sr.x,y:r.y-sr.y,w:r.width,h:r.height};};
 const items=[];
 const textRuns=e=>{
   const runs=[];
   function walk(n){
    if(n.nodeType===3){if(n.textContent)runs.push({text:n.textContent.replace(/\s+/g,' '),...style(n.parentElement),href:n.parentElement.closest('a')?.getAttribute('href')});return;}
    if(n.nodeType!==1||n.matches('svg,img'))return;
    if(n.tagName==='BR'){runs.push({text:'\n'});return;}
    [...n.childNodes].forEach(walk);
    if(n!==e && getComputedStyle(n).display==='block')runs.push({text:'\n'});
   }
   walk(e);
   if(runs.length){runs[0].text=runs[0].text.trimStart();runs[runs.length-1].text=runs[runs.length-1].text.trimEnd();}
   return runs.filter(r=>r.text);
 };
 const rectText=e=>{
   const runs=textRuns(e);if(!runs.length)return;
   let b=box(e), s=style(e);
   // Text in flex/grid containers may share a row with icons or labels.
   const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   while(walker.nextNode()){let n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('svg'))continue;let r=document.createRange();r.selectNodeContents(n);for(const q of r.getClientRects()){minX=Math.min(minX,q.x-sr.x);maxX=Math.max(maxX,q.right-sr.x);minY=Math.min(minY,q.y-sr.y);maxY=Math.max(maxY,q.bottom-sr.y);}}
   const left=b.x+s.pad[3],right=b.x+b.w-s.pad[1];
   if(Number.isFinite(minX)) {b={x:Math.max(left,minX),y:b.y+s.pad[0],w:Math.max(maxX-minX,right-Math.max(left,minX)),h:b.h-s.pad[0]-s.pad[2]};}
   items.push({kind:'text',box:b,style:s,runs,tag:e.tagName,cls:e.className});
 };
 function visit(e){
  if(e.matches('script,style,defs'))return;
  const b=box(e),s=style(e);if(!b.w||!b.h)return;
  if(e.classList.contains('arrow')&&e.textContent.trim()==='?'){items.push({kind:'arrow',box:b,style:s});return;}
  if(e.tagName==='TABLE'){
    items.push({kind:'table',box:b,rows:[...e.rows].map(r=>({h:box(r).h,cells:[...r.cells].map(c=>({box:box(c),style:style(c),runs:textRuns(c)}))}))});return;
  }
  if(e instanceof SVGElement){
   if(e.tagName==='svg'){
    const use=e.querySelector('use');const target=use?document.querySelector(use.getAttribute('href')):e;
    const vb=(target.getAttribute('viewBox')||e.getAttribute('viewBox')||'0 0 24 24').split(/\s+/).map(Number);
    const paths=[...target.querySelectorAll('path')].filter(p=>!p.closest('defs')).map(p=>({d:p.getAttribute('d'),stroke:getComputedStyle(p).stroke,fill:getComputedStyle(p).fill,width:num(getComputedStyle(p).strokeWidth),arrow:!!p.closest('g[marker-end]')}));
    items.push({kind:'svg',box:b,vb,paths,style:s});
   }return;
  }
  if(e.tagName==='IMG'){
   let clip={...b};for(let p=e.parentElement;p&&p!==slide;p=p.parentElement){if(['hidden','clip'].includes(getComputedStyle(p).overflow)){const q=box(p);const x=Math.max(q.x,clip.x),y=Math.max(q.y,clip.y);clip={x,y,w:Math.min(q.x+q.w,clip.x+clip.w)-x,h:Math.min(q.y+q.h,clip.y+clip.h)-y};}}
   items.push({kind:'image',box:b,clip,src:e.getAttribute('src')});return;
  }
  const opaque=c=>c!=='rgba(0, 0, 0, 0)'&&c!=='transparent';
  if(e!==slide&&(opaque(s.bg)||s.borders.some(b=>b.width&&b.style!=='none')))items.push({kind:'rect',box:b,style:s});
  if(e.classList.contains('eyebrow'))items.push({kind:'rect',box:{x:b.x,y:b.y+7,w:10,h:10},style:{bg:slide.classList.contains('dark')?'#ac8ce2':'#8067b6',radius:0,borders:[]}});
  const children=[...e.children].filter(c=>!c.matches('svg,br,img'));
  const inline=c=>['inline','inline-block'].includes(getComputedStyle(c).display);
  // A paragraph or a leaf container is one editable text box with rich runs.
  if(e.textContent.trim()&&(e.tagName==='H1'||children.every(inline))&&!e.querySelector('table')&&!e.querySelector('img')){
    rectText(e);[...e.children].filter(c=>c.tagName.toLowerCase()==='svg').forEach(visit);
  }else [...e.children].forEach(visit);
  if(e.classList.contains('flow-step')&&e.nextElementSibling)items.push({kind:'chevron',box:{x:b.x+b.w+5,y:b.y+44,w:12,h:18}});
 }
 visit(slide);
 return {id:slide.id,bg:style(slide).bg,items,title:slide.querySelector('h1').innerText,links:[...slide.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),plain:[...slide.querySelectorAll('*')].filter(e=>!e.closest('svg,.arrow')).flatMap(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent)).join('')};
 });
 });
 fs.writeFileSync(output,JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
"""


def px(value: float) -> int:
    """HTML pixels to EMU at 144 pixels per inch."""
    return round(value * 6350)


def color(value: str) -> RGBColor:
    if value.startswith('#'):
        return RGBColor.from_string(value[1:7])
    values = re.findall(r'[\d.]+', value)
    return RGBColor(*(round(float(x)) for x in values[:3]))


def visible(value: str) -> bool:
    return value not in ('none', 'transparent', 'rgba(0, 0, 0, 0)')


def path_points(data: str) -> list[list[tuple[float, float]]]:
    """Decode the source's orthogonal SVG paths into editable polylines.

    Arc segments in the small retry icon are approximated with their endpoints.
    The architecture and pixel artwork use only exact straight segments.
    """
    tokens = re.findall(r'[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', data)
    groups: list[list[tuple[float, float]]] = []
    i = 0
    x = y = 0.0
    cmd = ''
    group: list[tuple[float, float]] = []
    arity = {'m': 2, 'l': 2, 'h': 1, 'v': 1, 'a': 7, 'c': 6, 'q': 4}
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd.lower() == 'z':
                if group:
                    group.append(group[0]); x, y = group[0]
                cmd = ''
                continue
        if not cmd:
            continue
        n = arity[cmd.lower()]
        args = list(map(float, tokens[i:i+n])); i += n
        rel = cmd.islower()
        lower = cmd.lower()
        if lower in ('m', 'l', 'a', 'c', 'q'):
            nx, ny = args[-2:]
            if rel: nx += x; ny += y
        elif lower == 'h':
            nx, ny = args[0] + (x if rel else 0), y
        else:
            nx, ny = x, args[0] + (y if rel else 0)
        if lower == 'm':
            if group: groups.append(group)
            group = []
            cmd = 'l' if rel else 'L'
        x, y = nx, ny
        group.append((x, y))
    if group: groups.append(group)
    return groups


def raster_orbi(destination: Path) -> None:
    """Draw the original 32x32 SVG grid, then enlarge with nearest neighbour."""
    image = Image.new('RGBA', (32, 32))
    draw = ImageDraw.Draw(image)
    for element in ET.parse(HERE / 'assets/orbi.svg').getroot().iter():
        if element.tag.endswith('path'):
            for polygon in path_points(element.attrib['d']):
                # Pixel centers avoid Pillow's inclusive right/bottom boundaries.
                for y in range(32):
                    for x in range(32):
                        inside = False
                        for (ax, ay), (bx, by) in zip(polygon, polygon[1:]):
                            if (ay > y+.5) != (by > y+.5) and x+.5 < (bx-ax)*(y+.5-ay)/(by-ay)+ax:
                                inside = not inside
                        if inside: draw.point((x, y), fill=element.attrib['fill'])
    image.resize((1024, 1024), Image.Resampling.NEAREST).save(destination)


def add_line(slide, start, end, stroke, width=1, arrow=False):
    if start == end: return
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, px(start[0]), px(start[1]), px(end[0]), px(end[1]))
    shape.line.color.rgb = color(stroke)
    shape.line.width = Pt(width * .5)
    if arrow:
        tail = OxmlElement('a:tailEnd')
        tail.set('type', 'triangle'); tail.set('w', 'sm'); tail.set('len', 'sm')
        shape.line._get_or_add_ln().append(tail)
    return shape


def rect(slide, item):
    b, s = item['box'], item['style']
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if s['radius'] else MSO_SHAPE.RECTANGLE, px(b['x']), px(b['y']), px(b['w']), px(b['h']))
    if s['radius'] and min(b['w'], b['h']): shape.adjustments[0] = min(.5, s['radius']/min(b['w'],b['h']))
    if visible(s['bg']): shape.fill.solid(); shape.fill.fore_color.rgb = color(s['bg'])
    else: shape.fill.background()
    shape.line.fill.background()
    borders = s['borders']
    if len(borders)==4 and all(z['width']==borders[0]['width'] and z['color']==borders[0]['color'] for z in borders) and borders[0]['width']:
        shape.line.color.rgb = color(borders[0]['color']); shape.line.width = Pt(borders[0]['width']*.5)
    else:
        edges=[((b['x'],b['y']),(b['x']+b['w'],b['y'])),((b['x']+b['w'],b['y']),(b['x']+b['w'],b['y']+b['h'])),((b['x'],b['y']+b['h']),(b['x']+b['w'],b['y']+b['h'])),((b['x'],b['y']),(b['x'],b['y']+b['h']))]
        for border,(start,end) in zip(borders,edges):
            if border['width'] and border['style']!='none': add_line(slide,start,end,border['color'],border['width'])
    return shape


def fill_text(frame, runs, base, *, table=False):
    frame.clear()
    frame.word_wrap = True
    frame.auto_size = MSO_AUTO_SIZE.NONE
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    frame.vertical_anchor = MSO_ANCHOR.TOP
    paragraph = frame.paragraphs[0]
    def setup(p):
        p.alignment = {'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}.get(base['align'],PP_ALIGN.LEFT)
        p.space_before = p.space_after = Pt(0)
        p.line_spacing = Pt(base['line']*.5)
    setup(paragraph)
    for source in runs:
        for i, part in enumerate(source['text'].split('\n')):
            if i:
                paragraph = frame.add_paragraph(); setup(paragraph)
            if not part: continue
            if source.get('line',0)+source.get('mb',0)>base['line']:
                paragraph.line_spacing=Pt((source['line']+source.get('mb',0))*.5)
            run = paragraph.add_run(); run.text = part
            run.font.name = source.get('font',base['font'])
            # Table rows grow to fit their text, so cells get a little extra room.
            run.font.size = Pt(source.get('size',base['size'])*.5*(TABLE_FONT_SCALE if table else FONT_SCALE))
            run.font.bold = source.get('weight',base['weight']) >= 600
            run.font.color.rgb = color(source.get('color',base['color']))
            # Preserve the source's tracking, scaled with the font.
            tracking=source.get('spacing',base.get('spacing',0))
            if tracking: run._r.get_or_add_rPr().set('spc',str(round(tracking*.5*FONT_SCALE*100)))
            if source.get('href'): run.hyperlink.address = source['href']


def add_text(slide, item):
    b = item['box']
    # The smaller font reserves about 10% in both axes; retain HTML line rhythm.
    height = max(b['h']+3, max((r.get('size',0) for r in item['runs']), default=0)*FONT_SCALE*1.22+6)
    shape = slide.shapes.add_textbox(px(b['x']),px(b['y']),px(b['w']),px(height))
    shape.name = 'Title' if item['tag']=='H1' else 'Text'
    fill_text(shape.text_frame,item['runs'],item['style'])
    return shape


def add_table(slide, item):
    b, rows = item['box'], item['rows']
    shape=slide.shapes.add_table(len(rows),len(rows[0]['cells']),px(b['x']),px(b['y']),px(b['w']),px(b['h']))
    table=shape.table
    table.first_row=False; table.horz_banding=False
    for i,cell in enumerate(rows[0]['cells']): table.columns[i].width=px(cell['box']['w'])
    for r,row in enumerate(rows):
        table.rows[r].height=px(row['h'])
        for c,source in enumerate(row['cells']):
            cell=table.cell(r,c); s=source['style']; pad=s['pad']
            # Hard breaks tuned for the HTML widths make cells taller after re-wrapping
            # in Google Slides; let cell text flow instead.
            runs=[{**run,'text':re.sub(r'\s*\n\s*',' ',run['text'])} for run in source['runs']]
            fill_text(cell.text_frame,runs,s,table=True)
            cell.margin_top,cell.margin_right,cell.margin_bottom,cell.margin_left=[px(v) for v in pad]
            cell.vertical_anchor=MSO_ANCHOR.MIDDLE if r and item['box']['w']<1100 else MSO_ANCHOR.TOP
            if visible(s['bg']): cell.fill.solid();cell.fill.fore_color.rgb=color(s['bg'])
            else: cell.fill.background()
            for edge, border in zip(('T','R','B','L'),s['borders']):
                ln=OxmlElement('a:ln'+edge); ln.set('w',str(px(border['width'])))
                if border['width'] and border['style']!='none':
                    solid=OxmlElement('a:solidFill'); rgb=OxmlElement('a:srgbClr');rgb.set('val',str(color(border['color'])));solid.append(rgb);ln.append(solid)
                else: ln.append(OxmlElement('a:noFill'))
                cell._tc.get_or_add_tcPr().append(ln)
    return shape


def add_svg(slide, item):
    b, vb = item['box'], item['vb']
    sx,sy=b['w']/vb[2],b['h']/vb[3]
    for path in item['paths']:
        groups=path_points(path['d'])
        stroke=path['stroke']
        if not visible(stroke): stroke=item['style']['color']
        for points in groups:
            mapped=[(b['x']+(x-vb[0])*sx,b['y']+(y-vb[1])*sy) for x,y in points]
            for i,(start,end) in enumerate(zip(mapped,mapped[1:])):
                add_line(slide,start,end,stroke,path['width']*sx if path['width'] else 1.8*sx,path['arrow'] and i==len(mapped)-2)


def add_image(slide,item,orbi):
    b,c=item['box'],item['clip']
    source=orbi if item['src'].endswith('.svg') else HERE/item['src']
    picture=slide.shapes.add_picture(str(source),px(c['x']),px(c['y']),px(c['w']),px(c['h']))
    picture.crop_left=(c['x']-b['x'])/b['w'];picture.crop_top=(c['y']-b['y'])/b['h']
    picture.crop_right=(b['x']+b['w']-c['x']-c['w'])/b['w'];picture.crop_bottom=(b['y']+b['h']-c['y']-c['h'])/b['h']
    picture.name=Path(item['src']).name


def normalized(value):
    return re.sub(r'\s+',' ',value).strip()


def verify(path, data):
    """Reopen the saved package and validate content, links and native objects."""
    deck=Presentation(path)
    assert len(deck.slides)==16
    readme=(HERE/'README.md').read_text(encoding='utf-8')
    heading_section=readme.split('## Заголовки по порядку')[1].split('## Откуда цифры')[0]
    readme_titles=re.findall(r'^\d+\. (.+)$',heading_section,re.M)
    assert len(readme_titles)==16
    for i,(slide,source,summary) in enumerate(zip(deck.slides,data,readme_titles),1):
        text=[]; links=[]; titles=[]
        for shape in slide.shapes:
            if shape.shape_type==13: assert not(shape.width>=deck.slide_width*.98 and shape.height>=deck.slide_height*.98)
            frames=[shape.text_frame] if shape.has_text_frame else []
            if shape.has_table: frames += [cell.text_frame for row in shape.table.rows for cell in row.cells]
            for frame in frames:
                text.append(frame.text)
                for p in frame.paragraphs:
                    for run in p.runs:
                        if run.hyperlink.address:links.append(run.hyperlink.address)
            if shape.name=='Title':titles.append(shape.text)
        assert text, f'No editable text on slide {i}'
        title=normalized(' '.join(titles))
        assert title==normalized(source['title']), (i,title,source['title'])
        assert set(links)==set(source['links']), (i,links,source['links'])
        # README adds cover metadata and appendix labels; punctuation differs on #5.
        # Match all heading words exactly after removing those known wrappers.
        summary = re.sub(r"\s*\([^)]*\)", "", summary)
        summary = re.sub(r"^A[123]\.\s*", "", summary)
        canonical = lambda value: re.sub(r"[^\w]+", "", value.lower())
        assert canonical(title)==canonical(summary), (i,title,summary)
        # Compare every source text node in order, including native table cells.
        expected=[]
        for item in source['items']:
            if item['kind']=='text':expected.extend(r['text'] for r in item['runs'])
            elif item['kind']=='table':
                for row in item['rows']:
                    for cell in row['cells']:expected.extend(r['text'] for r in cell['runs'])
        assert normalized(''.join(expected))==normalized(''.join(text)),f'Text mismatch on slide {i}'
        assert 'Орби · Hack&Change 2026' in ' '.join(text)
        print(f'{i:02d}. {title}')
    assert any(s.has_table for s in deck.slides[8].shapes),'Slide 9 needs a native table'
    print(f'PASS: 16 slides; editable text on every slide; {sum(s.has_table for sl in deck.slides for s in sl.shapes)} native tables; all {sum(len(s["links"]) for s in data)} hyperlink occurrences; no full-slide pictures; HTML titles and README order verified.')


def main():
    # Slide titles contain characters outside legacy Windows console code pages.
    sys.stdout.reconfigure(encoding='utf-8')
    with tempfile.TemporaryDirectory(prefix='orbi-pptx-') as tmp:
        temp=Path(tmp)
        node=temp/'extract.cjs'; node.write_text(EXTRACT_JS,encoding='utf-8')
        subprocess.run(['node',str(node),str(ROOT),str(temp/'layout.json')],check=True)
        data=json.loads((temp/'layout.json').read_text(encoding='utf-8'))
        orbi=temp/'orbi.png';raster_orbi(orbi)
        deck=Presentation();deck.slide_width=px(1920);deck.slide_height=px(1080)
        for source in data:
            slide=deck.slides.add_slide(deck.slide_layouts[6])
            slide.background.fill.solid();slide.background.fill.fore_color.rgb=color(source['bg'])
            for item in source['items']:
                kind=item['kind']
                if kind=='rect':rect(slide,item)
                elif kind=='text':add_text(slide,item)
                elif kind=='table':add_table(slide,item)
                elif kind=='svg':add_svg(slide,item)
                elif kind=='image':add_image(slide,item,orbi)
                elif kind=='arrow':
                    b=item['box'];add_line(slide,(b['x'],b['y']+b['h']/2),(b['x']+b['w'],b['y']+b['h']/2),item['style']['color'],2,True)
                elif kind=='chevron':
                    b=item['box'];add_line(slide,(b['x'],b['y']),(b['x']+b['w'],b['y']+b['h']/2),'#a99abf',2)
                    add_line(slide,(b['x']+b['w'],b['y']+b['h']/2),(b['x'],b['y']+b['h']),'#a99abf',2)
        deck.save(OUTPUT)
        verify(OUTPUT,data)
        print(f'Saved: {OUTPUT}')
        soffice=shutil.which('soffice')
        if not soffice:
            for candidate in (Path('C:/Program Files/LibreOffice/program/soffice.exe'),Path('C:/Program Files (x86)/LibreOffice/program/soffice.exe')):
                if candidate.exists():soffice=str(candidate);break
        if soffice:
            target=HERE/'preview/pptx';target.mkdir(parents=True,exist_ok=True)
            subprocess.run([soffice,'-env:UserInstallation='+ (temp/'lo-profile').as_uri(),'--headless','--convert-to','pdf','--outdir',str(target),str(OUTPUT)],check=True)
            print(f'LibreOffice PDF: {target / (OUTPUT.stem+".pdf")}')
        else:
            print('LibreOffice not found: PPTX visual rendering was NOT performed. Structural/content checks completed; compare the original preview with PowerPoint/Google Slides after import.')


if __name__=='__main__':
    main()

