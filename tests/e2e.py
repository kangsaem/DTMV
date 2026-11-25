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
    await pg.wait_for_function("document.getElementById('stats').textContent.includes('노드')", timeout=90000)
    print('1 stats:', await pg.text_content('#stats'), '|', await pg.text_content('#mtext'))
    await pg.screenshot(path=OUT('1_line.png'))
    # 설정 변경: 칼선 + 확장 + 모서리
    await pg.click('.grp[data-g="SVG 출력"] > button')
    for k, v in [('cut', '30'), ('offset', '10'), ('corner', '50')]:
      await pg.eval_on_selector('#k_' + k, f"(e)=>{{e.value='{v}';e.dispatchEvent(new Event('input'))}}")
    await pg.wait_for_timeout(600)
    print('2 after settings:', await pg.text_content('#stats'), '|', await pg.text_content('#presetBtn'))
    await pg.screenshot(path=OUT('2_cut.png'))
    # 프리셋 저장
    await pg.click('#presetSave'); await pg.fill('#pop input', '내 칼선'); await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(200)
    print('3 preset:', await pg.text_content('#presetBtn'), json.loads(await pg.evaluate("localStorage.getItem('vman.presets')"))[0]['name'])
    await pg.click('#presetBtn'); await pg.wait_for_timeout(100); await pg.screenshot(path=OUT('3_presets.png'))
    async with pg.expect_download() as d: await pg.click('#plist [data-a=exp]')
    dl = await d.value; await dl.save_as(OUT('presets.json')); print('4 export:', dl.suggested_filename, json.load(open(OUT('presets.json')))['presets'][0]['values']['cut'])
    await pg.click('#plist .pi >> nth=0'); await pg.wait_for_timeout(300)
    print('5 builtin 기본:', await pg.text_content('#presetBtn'), await pg.input_value('#k_cut'))
    await pg.mouse.click(700, 400)
    await pg.set_input_files('#fpreset', OUT('presets.json')); await pg.wait_for_timeout(200)
    print('6 import:', await pg.text_content('#pop .msg')); await pg.click('#pop button')
    await pg.click('#presetBtn'); await pg.click('#plist .pi >> text=내 칼선'); await pg.wait_for_timeout(300)
    print('7 apply user preset cut =', await pg.input_value('#k_cut'))
    await pg.mouse.click(700, 400)
    await pg.click('#runAll'); await pg.wait_for_function("[...document.querySelectorAll('.it small')].every(s=>s.textContent.startsWith('완료'))", timeout=90000)
    await pg.click('#views button[data-v=cut]'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT('4_cutout.png'))
    for sel, nm in [('#sSvg', 'a.svg'), ('#sPng', 'a.png'), ('#sMask', 'm.png'), ('#sZip', 'a.zip')]:
      async with pg.expect_download() as d: await pg.click(sel)
      dl = await d.value; await dl.save_as(OUT(nm)); print('dl', dl.suggested_filename, os.path.getsize(OUT(nm)))
    # 새로고침 후 마지막 설정 기억
    await pg.reload(); await pg.wait_for_timeout(500)
    print('8 reload:', await pg.text_content('#presetBtn'), await pg.input_value('#k_cut'))
    errs = [l for l in logs if 'PAGEERR' in l or l.startswith('error')]
    print('errors:', errs[:5])
    await b.close()
asyncio.run(main())
