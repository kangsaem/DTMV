"""빌드된 exe 실행 확인: exe 를 --no-browser 로 켜고 /api/info 준비 → 2048 사진 1장 처리.
실행: python pc/smoke.py dist/VectorMan"""
import json, subprocess, sys, time, io, urllib.request
from pathlib import Path
from PIL import Image
d = Path(sys.argv[1]); exe = d / ('VectorMan.exe' if (d / 'VectorMan.exe').exists() else 'VectorMan')
p = subprocess.Popen([str(exe), '--no-browser'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
ok = False
info = {'ready': False, 'loading': True}
try:
    t = time.time()
    while time.time() - t < 600:
        try:
            info = json.loads(urllib.request.urlopen('http://127.0.0.1:8765/api/info', timeout=2).read())
            if info['ready'] or not info['loading']:
                break
        except Exception:
            pass
        time.sleep(2)
    print('info:', info, f'({time.time() - t:.0f}s)', flush=True)
    if info['ready']:
        n = info['size']; im = Image.open(Path(__file__).parent.parent / 'tests/person.jpg').convert('RGB').resize((n, n))
        b = io.BytesIO(); im.save(b, 'PNG')
        t = time.time()
        r = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8765/api/infer', data=b.getvalue(), method='POST'), timeout=1800)
        m = r.read(); print('mask bytes:', len(m), 'size header:', r.headers['X-Mask-Size'], f'{time.time() - t:.1f}s')
        import numpy as np; a = np.frombuffer(m, np.uint8); print('mask mean:', a.mean().round(1), 'min/max:', a.min(), a.max())
        ok = len(m) == n * n
finally:
    p.terminate()
    try: print(p.communicate(timeout=10)[0].decode('utf-8', 'replace')[-3000:])
    except Exception: pass
sys.exit(0 if ok else 1)
