#!/usr/bin/env python3
"""Local HTTP server for the static app and offline sherpa-onnx transcription."""
from __future__ import annotations

import io
import json
import os
import threading
import wave
from urllib.parse import urlsplit, unquote
import data_backend
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import sherpa_onnx

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / '.models' / 'sherpa-onnx-telespeech-ctc-int8-zh-2024-06-04'
MODEL = MODEL_DIR / 'model.int8.onnx'
TOKENS = MODEL_DIR / 'tokens.txt'
_recognizer = None
_recognizer_lock = threading.Lock()


def recognizer():
    global _recognizer
    if _recognizer is None:
        with _recognizer_lock:
            if _recognizer is None:
                if not MODEL.is_file() or not TOKENS.is_file():
                    raise FileNotFoundError('本机方言模型尚未安装')
                _recognizer = sherpa_onnx.OfflineRecognizer.from_telespeech_ctc(
                    model=str(MODEL), tokens=str(TOKENS), num_threads=max(1, min(4, os.cpu_count() or 1))
                )
    return _recognizer


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if any(part.startswith('.') for part in path.split('/') if part):
            self.send_json(404, {'error': 'not found'})
            return
        if data_backend.handle_get(self):
            return
        if path in ('/admin', '/admin/'):
            self.path = '/admin.html'
        if self.path == '/api/health':
            self.send_json(200, {'available': MODEL.is_file() and TOKENS.is_file(), 'engine': 'sherpa-onnx TeleSpeech CTC', 'localOnly': True})
            return
        super().do_GET()

    def do_POST(self):
        if data_backend.handle_post(self):
            return
        if self.path != '/api/transcribe':
            self.send_json(404, {'error': 'not found'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 16 * 1024 * 1024:
                self.send_json(413, {'error': '录音文件为空或超过 16 MB'})
                return
            payload = self.rfile.read(length)
            with wave.open(io.BytesIO(payload), 'rb') as wav:
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                    raise ValueError('音频格式不支持')
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
                rate = wav.getframerate()
            if samples.size == 0:
                self.send_json(400, {'error': '录音中没有可识别的音频'})
                return
            asr = recognizer()
            stream = asr.create_stream()
            stream.accept_waveform(rate, samples)
            asr.decode_stream(stream)
            self.send_json(200, {'text': stream.result.text.strip(), 'engine': 'sherpa-onnx TeleSpeech CTC', 'localOnly': True})
        except FileNotFoundError as exc:
            self.send_json(503, {'error': str(exc)})
        except (wave.Error, ValueError) as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception as exc:
            self.send_json(500, {'error': '本机语音识别失败：' + str(exc)})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '4173'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'乡音本机服务：http://127.0.0.1:{port}/', flush=True)
    server.serve_forever()
