"""크롬 자동 테스트(가짜 모델). 먼저 tests/setup_vend.sh. 실행: python tests/e2e.py"""
import asyncio, os, json, pathlib
from playwright.async_api import async_playwright
T = pathlib.Path(__file__).parent; V = str(T / '.vend') + '/'; OUT = lambda n: str(T / ('.out_' + n))

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = await b.new_page(viewport={'width': 1400, 'height': 860}, accept_downloads=True)
    logs = []; pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('PAGEERR ' + str(e)))
    async def route(r):
      u = r.request.url
      if 'huggingface' in u: return await r.fulfill(path=V + 'fake.onnx', headers={'access-control-allow-origin': '*'})
      if 'jszip' in u: return await r.fulfill(path=V + 'jszip.min.js', content_type='application/javascript')
      if 'onnxruntime-web' in u:
        f = u.split('/')[-1]
        return await r.fulfill(path=V + f, content_type='application/wasm' if f.endswith('.wasm') else 'application/javascript', headers={'access-control-allow-origin': '*'})
      if u.startswith('http'): return await r.abort()
      await r.continue_()
    await pg.route('**/*', route)
    await pg.goto((T.parent / 'web/vectorman.html').as_uri())
    await pg.screenshot(path=OUT('0_empty.png'))
    await pg.set_input_files('#fin', [str(T / 'person.jpg')] * 2)
    await pg.wait_for_function("/\\d/.test(document.getElementById('pts').textContent)", timeout=90000)
    print('1 pts:', await pg.text_content('#pts'), '|', await pg.text_content('#mtext'))
    await pg.screenshot(path=OUT('1_line.png'))
    await pg.eval_on_selector('#k_target', "(e)=>{e.value='40';e.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(500)
    print('1b target 40:', await pg.text_content('#pts'))
    await pg.eval_on_selector('#k_target', "(e)=>{e.value='0';e.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(300)
    # 설정 변경: 칼선 + 확장 + 모서리
    await pg.click('#rail [data-sec=out]')
    for k, v in [('cut', '30'), ('offset', '10'), ('corner', '50')]:
      await pg.eval_on_selector('#k_' + k, f"(e)=>{{e.value='{v}';e.dispatchEvent(new Event('input'))}}")
    await pg.wait_for_timeout(600)
    print('2 after settings:', await pg.text_content('#pts'), '|', await pg.text_content('#presetBtn'))
    await pg.screenshot(path=OUT('2_cut.png'))
    # 프리셋 저장
    await pg.click('#rail [data-sec=preset]'); await pg.click('#presetSave'); await pg.fill('#pop input', '내 칼선'); await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(200)
    print('3 preset:', await pg.text_content('#presetBtn'), json.loads(await pg.evaluate("localStorage.getItem('vman.presets')"))[0]['name'])
    await pg.click('#presetBtn'); await pg.wait_for_timeout(100); await pg.screenshot(path=OUT('3_presets.png'))
    async with pg.expect_download() as d: await pg.click('#presetPane [data-a=exp]')
    dl = await d.value; await dl.save_as(OUT('presets.json')); print('4 export:', dl.suggested_filename, json.load(open(OUT('presets.json')))['presets'][0]['values']['cut'])
    await pg.click('#plist .pi >> nth=0'); await pg.wait_for_timeout(300)
    print('5 builtin 기본:', await pg.text_content('#presetBtn'), await pg.input_value('#k_cut'))
    await pg.mouse.click(700, 120)
    await pg.set_input_files('#fpreset', OUT('presets.json')); await pg.wait_for_timeout(200)
    print('6 import:', await pg.text_content('#pop .msg')); await pg.click('#pop button')
    await pg.click('#rail [data-sec=preset]'); await pg.click('#plist .pi >> text=내 칼선'); await pg.wait_for_timeout(300)
    print('7 apply user preset cut =', await pg.input_value('#k_cut'))
    await pg.mouse.click(700, 120)
    await pg.click('#runAll'); await pg.wait_for_function("[...document.querySelectorAll('.it small')].every(s=>s.textContent.startsWith('완료'))", timeout=90000)
    await pg.click('#views button[data-v=cut]'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT('4_cutout.png')); await pg.keyboard.press('2'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT('6_vmask.png'))
    for sel, nm in [('#sSvg', 'a.svg'), ('#sPng', 'a.png'), ('#sMask', 'm.png'), ('#sZip', 'a.zip')]:
      async with pg.expect_download() as d: await pg.click(sel)
      dl = await d.value; await dl.save_as(OUT(nm)); print('dl', dl.suggested_filename, os.path.getsize(OUT(nm)))
    # 되돌리기: 슬라이더 3번 변경 → Ctrl+Z 3번 → 처음 값, Ctrl+Shift+Z → 다시
    v0 = await pg.input_value('#k_thr')
    for v in ['0.3', '0.4', '0.6']:
      await pg.eval_on_selector('#k_thr', f"(e)=>{{e.value='{v}';e.dispatchEvent(new Event('input'))}}"); await pg.wait_for_timeout(500)
    await pg.mouse.click(700, 120)
    for _ in range(3): await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
    u = await pg.input_value('#k_thr'); await pg.keyboard.press('Control+Shift+z'); await pg.wait_for_timeout(100)
    print('9 undo:', v0, '→', u, '| redo →', await pg.input_value('#k_thr'), '| 페더 라벨:', await pg.text_content('label[for=k_feather]'), '| 확장 범위:', await pg.get_attribute('#k_offset', 'max'))
    await pg.click('#rail [data-sec=preset]'); print('10 presets:', [await e.text_content() for e in await pg.query_selector_all('#plist .pi span')]); await pg.mouse.click(700, 120)
    # 누적형 브러시: [+] 두 번 칠함 → 점 증가(누적), [−] 칠함 → 감소, 전체 지우기 → Ctrl+Z 복구
    box = await pg.query_selector('#cv'); bb = await box.bounding_box()
    async def stroke(alt=False):
      if alt: await pg.keyboard.down('Alt')
      await pg.mouse.move(bb['x'] + bb['width'] * .35, bb['y'] + 120); await pg.mouse.down()
      for k in range(12): await pg.mouse.move(bb['x'] + bb['width'] * (.35 + k * .025), bb['y'] + 140 + k * 8)
      await pg.mouse.up()
      if alt: await pg.keyboard.up('Alt')
      await pg.wait_for_timeout(600); return (await pg.text_content('#pts')).split('점')[0]
    p0 = (await pg.text_content('#pts')).split('점')[0]
    await pg.click('#tools [data-m="+"]'); a1 = await stroke(); a2 = await stroke()
    await pg.mouse.move(bb['x'] + bb['width'] * .4, bb['y'] + 150); await pg.wait_for_timeout(100); hv = await pg.text_content('#hv')
    await pg.screenshot(path=OUT('5_brush.png'))
    await pg.keyboard.press('2'); await pg.wait_for_timeout(300); await pg.mouse.move(bb['x'] + bb['width'] * .45, bb['y'] + 160); await pg.wait_for_timeout(200); await pg.screenshot(path=OUT('7_vmask_brush.png')); await pg.keyboard.press('1')
    a3 = await stroke(alt=True)
    await pg.click('#tools [data-m="-"]'); a4 = await stroke(); a5 = await stroke()
    await pg.click('#zclear'); await pg.wait_for_timeout(500); a6 = (await pg.text_content('#pts')).split('점')[0] + ' 표시칸 ' + str(await pg.evaluate("document.querySelector('#cv') && 0"))
    await pg.click('#tools [data-t="view"]'); await pg.mouse.click(700, 120)
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500); a7 = (await pg.text_content('#pts')).split('점')[0]
    print('11 brush:', p0, '| +', a1, '| + 누적', a2, '| 칸', hv, '| Alt', a3, '| −', a4, '| − 누적', a5, '| 전체 지우기', a6, '| Ctrl+Z', a7)
    await pg.keyboard.press('Control+Shift+z'); await pg.wait_for_timeout(300)
    async with pg.expect_download() as d: await pg.click('#sSvg')
    dl = await d.value; print('12 svg name:', dl.suggested_filename)
    # 목록 삭제: Del → 1개, Ctrl+Z → 2개, 오른쪽 메뉴 삭제
    await pg.click('.it >> nth=1'); await pg.wait_for_timeout(400); await pg.mouse.click(700, 300)
    await pg.keyboard.press('Delete'); await pg.wait_for_timeout(300); n1 = await pg.locator('.it').count()
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500); n2 = await pg.locator('.it').count()
    await pg.click('.it >> nth=0', button='right'); await pg.click('#ctx [data-a=del]'); await pg.wait_for_timeout(300); n3 = await pg.locator('.it').count()
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
    print('13 list:', n1, '→ undo', n2, '→ 오른쪽 삭제', n3, '→ undo', await pg.locator('.it').count(), '| 선택', await pg.text_content('.it.sel b'))
    # v0.8: 파일명 뒤 단어 · 배경색 · 설정 아이콘 → 스크롤 강조
    await pg.fill('#k_suffix', '_test'); await pg.wait_for_timeout(200)
    async with pg.expect_download() as d: await pg.click('#sPng')
    print('14 name:', (await d.value).suggested_filename, '|', await pg.text_content('#nmEx'))
    await pg.click('#views [data-v=vmask]'); await pg.click('#bgBox [data-bg="#00b140"]'); await pg.click('#rail [data-sec=brush]'); await pg.wait_for_timeout(900)
    await pg.screenshot(path=OUT('9_bg.png'))
    px = await pg.evaluate("(()=>{const c=document.getElementById('cv'),g=c.getContext('2d'),v=window.devicePixelRatio||1,r=document.getElementById('cv').getBoundingClientRect();return [...g.getImageData(Math.round(c.width*0.5),Math.round(c.height*0.06),1,1).data].slice(0,3)})()")
    opn = await pg.evaluate("[...document.querySelectorAll('#drawer .sec.open')].map(x=>x.dataset.sec)")
    await pg.click('#allBtn'); opn2 = await pg.evaluate("document.querySelectorAll('#drawer .sec.open').length")
    print('15 bg: 사진 위쪽 픽셀', px, '| 작업대', await pg.evaluate("getComputedStyle(document.getElementById('stage')).backgroundColor"), '| 펼침', opn, '→ 전체 펴기', opn2, '| hl:', await pg.evaluate("document.querySelector('#drawer .sec.hl').dataset.sec"), '| top:', await pg.text_content('#topline'))
    await pg.screenshot(path=OUT('8_layout.png'))
    # 새로고침 후 마지막 설정 기억
    await pg.reload(); await pg.wait_for_timeout(500)
    print('8 reload:', await pg.text_content('#presetBtn'), await pg.input_value('#k_cut'))
    errs = [l for l in logs if 'PAGEERR' in l or l.startswith('error')]
    print('errors:', errs[:5])
    await b.close()
asyncio.run(main())
