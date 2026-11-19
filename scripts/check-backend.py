import base64
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import asr_server
import data_backend

class BackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        data_backend.DATA=Path(cls.tmp.name)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),asr_server.Handler)
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def test_roundtrip(self):
        audio=b'example audio bytes'
        payload={'voice':{'id':'test-record','phrase':'侬好','savedAt':123,'topic':'日常问候','label':'无锡'},'audio':base64.b64encode(audio).decode(),'mime':'audio/webm'}
        req=lambda body:urllib.request.Request(self.base+'/api/voices',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
        for _ in range(2):
            self.assertEqual(json.load(urllib.request.urlopen(req(payload)))['saved'],True)
        voices=json.load(urllib.request.urlopen(self.base+'/api/voices'))['voices']
        self.assertEqual(len(voices),1)
        self.assertEqual(voices[0]['phrase'],'侬好')
        self.assertEqual(urllib.request.urlopen(self.base+'/api/voices/test-record/audio').read(),audio)
        self.assertIn('侬好',urllib.request.urlopen(self.base+'/api/voices/export').read().decode('utf-8-sig'))
        payload['voice']['id']='../../bad'
        with self.assertRaises(urllib.error.HTTPError) as exc:urllib.request.urlopen(req(payload))
        self.assertEqual(exc.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as exc:urllib.request.urlopen(self.base+'/.data/voices.sqlite3')
        self.assertEqual(exc.exception.code,404)
        self.assertIn('乡音',urllib.request.urlopen(self.base+'/admin').read().decode())
if __name__=='__main__': unittest.main()
