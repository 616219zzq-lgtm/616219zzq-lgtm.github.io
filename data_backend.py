"""SQLite-backed recording API; served only by the loopback HTTP server."""
import base64
import csv
import io
import json
import re
import os
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(os.environ.get('XIANGYIN_DATA_DIR', str(Path(__file__).resolve().parent / '.data')))

def connect():
    DATA.mkdir(exist_ok=True)
    db = sqlite3.connect(DATA / 'voices.sqlite3', timeout=15)
    db.execute('CREATE TABLE IF NOT EXISTS voices (id TEXT PRIMARY KEY, metadata TEXT NOT NULL, audio BLOB NOT NULL, mime TEXT NOT NULL)')
    return db

def handle_get(h):
    path = urlsplit(h.path).path
    if not path.startswith('/api/voices'):
        return False
    with connect() as db:
        if path in ('/api/voices', '/api/voices/export'):
            rows = [json.loads(row[0]) for row in db.execute('SELECT metadata FROM voices ORDER BY rowid DESC')]
            if path.endswith('/export'):
                output = io.StringIO()
                fields = ['id','savedAt','topic','label','phrase','duration','pitch','timbre','speed']
                writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore')
                writer.writeheader()
                for row in rows:
                    row = {k: ("'"+str(v) if str(v).startswith(('=','+','-','@')) else v) for k,v in row.items()}
                    writer.writerow(row)
                send(h, 200, ('﻿'+output.getvalue()).encode(), 'text/csv; charset=utf-8', 'attachment; filename="xiangyin-recordings.csv"')
            else:
                h.send_json(200, {'voices': rows})
            return True
        match = re.fullmatch(r'/api/voices/([A-Za-z0-9_-]{1,100})/audio', path)
        row = db.execute('SELECT audio,mime FROM voices WHERE id=?', (match[1],)).fetchone() if match else None
        if row:
            send(h,200,row[0],row[1])
        else:
            h.send_json(404, {'error':'录音不存在'})
    return True

def send(h, status, data, mime, disposition=None):
    h.send_response(status)
    h.send_header('Content-Type', mime)
    h.send_header('Content-Length', str(len(data)))
    h.send_header('Cache-Control','no-store')
    h.send_header('X-Content-Type-Options','nosniff')
    if disposition: h.send_header('Content-Disposition',disposition)
    h.end_headers()
    h.wfile.write(data)

def handle_post(h):
    if urlsplit(h.path).path != '/api/voices': return False
    try:
        origin = h.headers.get('Origin')
        if origin and origin != 'http://' + h.headers.get('Host',''):
            h.send_json(403, {'error':'不允许跨站写入'}); return True
        if h.headers.get_content_type() != 'application/json':
            raise ValueError('需要 JSON 数据')
        length = int(h.headers.get('Content-Length','0'))
        if not 0 < length <= 24 * 1024 * 1024: raise ValueError('录音超过大小限制')
        payload = json.loads(h.rfile.read(length))
        meta = payload['voice']
        if not isinstance(meta,dict): raise ValueError('录音信息无效')
        identifier = meta.get('id','')
        if not isinstance(identifier,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',identifier): raise ValueError('录音编号无效')
        if not isinstance(meta.get('phrase'),str) or not meta['phrase'].strip() or len(meta['phrase'])>20000: raise ValueError('录音文字无效')
        allowed = ['id','dialectId','phrase','prompt','label','mat','css','district','topic','seed','pitch','timbre','speed','rate','duration','savedAt']
        meta = {k:meta[k] for k in allowed if k in meta}
        if any(isinstance(v,(dict,list)) for v in meta.values()): raise ValueError('字段格式无效')
        meta.update(hasAudio=True, visibility='public')
        audio = base64.b64decode(payload['audio'], validate=True)
        if not 0<len(audio)<=16*1024*1024: raise ValueError('音频为空或超过 16 MB')
        mime = payload.get('mime','audio/webm').split(';')[0]
        if mime not in ('audio/webm','audio/ogg','audio/wav','audio/mp4','audio/mpeg'): raise ValueError('音频格式不支持')
        with connect() as db:
            db.execute('INSERT INTO voices VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,audio=excluded.audio,mime=excluded.mime',(identifier,json.dumps(meta,ensure_ascii=False),audio,mime))
        h.send_json(200, {'saved':True,'id':identifier})
    except (ValueError,KeyError,TypeError) as exc:
        h.send_json(400, {'error':str(exc)})
    except Exception:
        h.send_json(500, {'error':'数据库保存失败，请重试'})
    return True
