"""Vector Man PC 엔진.

내 PC 안에서만 접속되는 작은 서버(127.0.0.1)를 띄우고 브라우저에 Vector Man 화면을 연다.
AI(인물 마스크)는 이 프로그램이 ONNX Runtime 으로 계산한다. GPU = DirectML(엔비디아·AMD·인텔), 안 되면 CPU.
벡터 계산·브러시·저장은 화면(브라우저)이 그대로 한다.

  /               화면 (app/vectorman.html)
  /vendor/...     화면이 쓰는 라이브러리 (인터넷 없이)
  /api/info       엔진 상태 {ready, loading, error, device, model, size}
  /api/infer      POST 사진(PNG, 모델 크기 정사각) → 마스크 uint8 (size×size), 헤더 X-Mask-Size

모델: 실행 파일 옆 models/ 폴더의 첫 .onnx (없으면 화면에 안내).
"""
import io
import json
import socket
import sys
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from PIL import Image

HOST = "127.0.0.1"
PORTS = range(8765, 8786)
FROZEN = getattr(sys, "frozen", False)
RES = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))          # 함께 묶인 화면·라이브러리
APP = Path(sys.executable).parent if FROZEN else Path(__file__).parent  # 실행 파일 폴더 (models/)
VERSION = (RES / "app" / "VERSION").read_text().strip() if (RES / "app" / "VERSION").is_file() else "dev"
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


class Engine:
    def __init__(self):
        self.sess = None
        self.state = {"ready": False, "loading": True, "error": "", "device": "", "model": "", "size": 0, "version": VERSION}
        self.lock = threading.Lock()

    def find_model(self):
        for d in (APP / "models", APP.parent / "models", RES / "models"):
            if d.is_dir():
                ms = sorted(d.glob("*.onnx"))
                if ms:
                    return ms[0]
        return None

    def load(self):
        try:
            import onnxruntime as ort
            path = self.find_model()
            if not path:
                raise FileNotFoundError("models 폴더에 모델 파일(.onnx)이 없습니다.")
            self.state["model"] = path.name
            log("모델:", path)
            avail = ort.get_available_providers()
            tries = ([["DmlExecutionProvider", "CPUExecutionProvider"]] if "DmlExecutionProvider" in avail else []) + [["CPUExecutionProvider"]]
            last = None
            for prov in tries:
                try:
                    so = ort.SessionOptions()
                    so.log_severity_level = 3
                    sess = ort.InferenceSession(str(path), so, providers=prov)
                    self.sess = sess
                    self.state["device"] = "DirectML (GPU)" if sess.get_providers()[0] == "DmlExecutionProvider" else "CPU"
                    break
                except Exception as e:  # GPU 초기화 실패 → CPU
                    last = e
                    log("엔진 시작 실패:", prov[0], e)
            if not self.sess:
                raise last
            inp = self.sess.get_inputs()[0]
            self.in_name, self.in_type = inp.name, inp.type
            shape = [d if isinstance(d, int) else 1024 for d in inp.shape]
            self.size = int(shape[-1])
            self.state.update(ready=True, size=self.size)
            log(f"준비됨 · {self.state['device']} · 입력 {self.size}px · {self.in_type}")
        except Exception as e:
            traceback.print_exc()
            self.state["error"] = str(e)
        finally:
            self.state["loading"] = False

    def infer(self, data):
        S = self.size
        img = Image.open(io.BytesIO(data)).convert("RGB")
        if img.size != (S, S):
            img = img.resize((S, S), Image.Resampling.BILINEAR)
        x = (np.asarray(img, np.float32) / 255.0 - MEAN) / STD
        x = x.transpose(2, 0, 1)[None]
        if "float16" in self.in_type:
            x = x.astype(np.float16)
        t = time.time()
        with self.lock:
            out = self.sess.run(None, {self.in_name: x})[0]
        a = np.asarray(out, np.float32).reshape(out.shape[-2], out.shape[-1])
        if a.min() < -0.01 or a.max() > 1.01:   # 시그모이드가 그래프 밖에 있는 모델
            a = 1 / (1 + np.exp(-a))
        if a.shape != (S, S):
            a = np.asarray(Image.fromarray(a).resize((S, S), Image.Resampling.BILINEAR))
        log(f"처리 {time.time() - t:.2f}초")
        return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes(), S


ENGINE = Engine()
TYPES = {".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript", ".wasm": "application/wasm", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/info":
            return self.send(200, json.dumps(ENGINE.state).encode(), "application/json")
        rel = "app/vectorman.html" if p in ("/", "/index.html") else "app" + p
        f = (RES / rel).resolve()
        if RES.resolve() not in f.parents or not f.is_file():
            return self.send(404, b"not found", "text/plain")
        self.send(200, f.read_bytes(), TYPES.get(f.suffix, "application/octet-stream"))

    def do_POST(self):
        if self.path.split("?")[0] != "/api/infer":
            return self.send(404, b"not found", "text/plain")
        if not ENGINE.state["ready"]:
            return self.send(503, json.dumps({"error": ENGINE.state["error"] or "엔진 준비 중"}).encode(), "application/json")
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n <= 0 or n > 200_000_000:
                raise ValueError("사진 크기가 올바르지 않습니다.")
            mask, s = ENGINE.infer(self.rfile.read(n))
            self.send(200, mask, "application/octet-stream", {"X-Mask-Size": str(s)})
        except Exception as e:
            traceback.print_exc()
            self.send(500, json.dumps({"error": str(e)}).encode(), "application/json")


def already_running(port):
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/info", timeout=1) as r:
            return "ready" in json.loads(r.read())
    except Exception:
        return False


def main():
    print(f"Vector Man PC 엔진 v{VERSION}\n이 창을 닫으면 종료됩니다.\n", flush=True)
    if "--no-browser" not in sys.argv and already_running(PORTS[0]):   # 이미 켜져 있으면 화면만 다시 연다
        webbrowser.open(f"http://{HOST}:{PORTS[0]}/")
        return
    srv = None
    for port in PORTS:
        try:
            srv = ThreadingHTTPServer((HOST, port), Handler)
            break
        except OSError:
            continue
    if not srv:
        log("사용할 수 있는 포트가 없습니다 (8765~8785).")
        input("엔터를 누르면 닫힙니다.")
        return
    url = f"http://{HOST}:{port}/"
    threading.Thread(target=ENGINE.load, daemon=True).start()
    log("화면 주소:", url)
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
