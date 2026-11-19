#!/bin/zsh
set -e
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import sherpa_onnx, numpy' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -r requirements-asr.txt
fi
MODEL_DIR=.models/sherpa-onnx-telespeech-ctc-int8-zh-2024-06-04
if [[ ! -f "$MODEL_DIR/model.int8.onnx" ]]; then
  mkdir -p .models
  curl -L --fail --retry 2 -o /tmp/xiangyin-telespeech.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-telespeech-ctc-int8-zh-2024-06-04.tar.bz2
  tar -xjf /tmp/xiangyin-telespeech.tar.bz2 -C .models
  rm /tmp/xiangyin-telespeech.tar.bz2
fi
exec .venv/bin/python asr_server.py
