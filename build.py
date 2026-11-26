"""src/ → web/vectorman.html (한 파일). 실행: python build.py"""
from pathlib import Path
R = Path(__file__).parent
MODEL = "https://huggingface.co/jiabins0303/birefnet-lite-1024-webgpu/resolve/main/onnx/model_fp16.onnx"
t = (R / "src/template.html").read_text(encoding="utf-8")
t = t.replace("MODEL_URL_PH", MODEL).replace("/*CORE*/", (R / "src/core.js").read_text(encoding="utf-8"))
ver = (R / "VERSION").read_text().strip()
t = t.replace("__VER__", ver)
(R / "web/vectorman.html").write_text(t, encoding="utf-8")
(R / "index.html").write_text(t, encoding="utf-8")   # GitHub Pages(브랜치 배포) 첫 화면 = 웹 버전
print("built web/vectorman.html", ver)

# PC 엔진용 화면: 인터넷 없이 (ONNX Runtime Web 빼고, JSZip 은 /vendor/ 에서)
pc = t.replace('<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.webgpu.min.js"></script>\n', '')
pc = pc.replace('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', '/vendor/jszip.min.js')
assert pc != t and '/vendor/jszip.min.js' in pc
(R / "pc/app").mkdir(parents=True, exist_ok=True)
(R / "pc/app/vectorman.html").write_text(pc, encoding="utf-8")
(R / "pc/app/VERSION").write_text(ver, encoding="utf-8")
print("built pc/app/vectorman.html")
