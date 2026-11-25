"""src/ → web/vectorman.html (한 파일). 실행: python build.py"""
from pathlib import Path
R = Path(__file__).parent
MODEL = "https://huggingface.co/jiabins0303/birefnet-lite-1024-webgpu/resolve/main/onnx/model_fp16.onnx"
t = (R / "src/template.html").read_text(encoding="utf-8")
t = t.replace("MODEL_URL_PH", MODEL).replace("/*CORE*/", (R / "src/core.js").read_text(encoding="utf-8"))
ver = (R / "VERSION").read_text().strip()
t = t.replace("__VER__", ver)
(R / "web/vectorman.html").write_text(t, encoding="utf-8")
print("built web/vectorman.html", ver)
