"""PC 엔진 자동 테스트: 서버(가짜 모델) + 크롬. 실행: python tests/e2e_pc.py [fp16]"""
import asyncio, os, sys, subprocess, time, json, pathlib, shutil, urllib.request
from playwright.async_api import async_playwright
T = pathlib.Path(__file__).parent; R = T.parent; OUT = lambda n: str(T / ('.out_pc_' + n))
fp16 = 'fp16' in sys.argv
md = R / 'pc/models'; shutil.rmtree(md, ignore_errors=True)
subprocess.run([sys.executable, str(T / 'make_fake_pc_model.py'), str(md / 'fake.onnx'), '1' if fp16 else '0'], check=True)
srv = subprocess.Popen([sys.executable, str(R / 'pc/vectorman_pc.py'), '--no-browser'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
async def main():
  for _ in range(50):
    try: info = json.loads(urllib.request.urlopen('http://127.0.0.1:8765/api/info').read()); break
    except Exception: time.sleep(.2)
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = await b.new_page(viewport={'width': 1400, 'height': 860}, accept_downloads=True)
    logs = []; pg.on('pageerror', lambda e: logs.append('PAGEERR ' + str(e)))
    async def route(r):   # 인터넷 차단 상태 흉내
      if r.request.url.startswith('http://127.0.0.1'): return await r.continue_()
      await r.abort()
    await pg.route('**/*', route)
    await pg.goto('http://127.0.0.1:8765/')
    await pg.wait_for_function("document.getElementById('mtext').textContent.startsWith('PC ·')", timeout=60000)
    print('engine:', await pg.text_content('#mtext'), '| select:', await pg.input_value('#engine'))
    await pg.set_input_files('#fin', [str(T / 'person.jpg')] * 2)
    await pg.wait_for_function("/\\d/.test(document.getElementById('pts').textContent)", timeout=120000)
    print('pts:', await pg.text_content('#pts'), '|', await pg.text_content('.it small'))
    await pg.screenshot(path=OUT('1.png'))
    await pg.click('#runAll'); await pg.wait_for_function("[...document.querySelectorAll('.it small')].every(s=>s.textContent.startsWith('완료'))", timeout=120000)
    for sel, nm in [('#sSvg', 'a.svg'), ('#sZip', 'a.zip')]:
      async with pg.expect_download() as d: await pg.click(sel)
      dl = await d.value; await dl.save_as(OUT(nm)); print('dl', dl.suggested_filename, os.path.getsize(OUT(nm)))
    print('errors:', logs[:3])
    await b.close()
try: asyncio.run(main())
finally:
  srv.terminate(); out = srv.communicate(timeout=5)[0]; print('--- server log ---'); print(out[-1500:])
