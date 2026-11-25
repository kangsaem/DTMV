import asyncio, os, sys
from playwright.async_api import async_playwright
import pathlib; T=pathlib.Path(__file__).parent; V=str(T/'.vend')+'/'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=await b.new_page(viewport={'width':1300,'height':820}, accept_downloads=True)
    logs=[]; pg.on('console',lambda m:logs.append(m.type+': '+m.text)); pg.on('pageerror',lambda e:logs.append('PAGEERR '+str(e)))
    async def route(r):
      u=r.request.url
      if 'huggingface' in u: return await r.fulfill(path=V+'fake.onnx',headers={'access-control-allow-origin':'*'})
      if 'jszip' in u: return await r.fulfill(path=V+'jszip.min.js',content_type='application/javascript')
      if 'onnxruntime-web' in u:
        f=u.split('/')[-1]; ct='application/wasm' if f.endswith('.wasm') else 'application/javascript'
        return await r.fulfill(path=V+f,content_type=ct,headers={'access-control-allow-origin':'*'})
      await r.continue_()
    await pg.route('**/*',route)
    await pg.goto((T.parent/'web/vectorman.html').as_uri())
    await pg.set_input_files('#fin',[str(T/'person.jpg')]*2)
    await pg.wait_for_function("document.getElementById('stats').textContent.includes('노드')",timeout=90000)
    print('stats:',await pg.text_content('#stats'), '| model:',await pg.text_content('#mtext'))
    await pg.screenshot(path=str(T/'.out_s1.png'))
    await pg.click('#runAll'); await pg.wait_for_function("[...document.querySelectorAll('.it small')].every(s=>s.textContent.startsWith('완료'))",timeout=90000)
    await pg.fill('#sm','8'); await pg.dispatch_event('#sm','input'); await pg.wait_for_timeout(500)
    print('after smooth:',await pg.text_content('#stats'))
    await pg.click('#views button[data-v=cut]'); await pg.wait_for_timeout(300); await pg.screenshot(path=str(T/'.out_s2.png'))
    for sel,nm in [('#sSvg','a.svg'),('#sPng','a.png'),('#sZip','a.zip')]:
      async with pg.expect_download() as d: await pg.click(sel)
      dl=await d.value; await dl.save_as(str(T/('.out_'+nm))); print(sel, dl.suggested_filename, os.path.getsize(T/('.out_'+nm)))
    print('\n'.join(logs[-15:]))
    await b.close()
asyncio.run(main())
