#!/usr/bin/env bash
# One-time setup for the Kokoro AI voice (npm run voice:setup). Free, local, CPU only.
#   - Python venv in studio/.kokoro-venv with kokoro-onnx (Apache-2.0) + soundfile
#   - model files in studio/.kokoro/ (~350 MB, from the kokoro-onnx GitHub release), checked by sha256
# Needs Python 3.10–3.13 (onnxruntime has no wheels for 3.14 on Intel Macs yet).
set -euo pipefail
cd "$(dirname "$0")/.."

PY=""
for p in python3.12 python3.13 python3.11 python3.10; do
  if command -v "$p" >/dev/null 2>&1; then PY="$p"; break; fi
done
if [ -z "$PY" ]; then
  echo "Need Python 3.10–3.13 (e.g. brew install python@3.12)." >&2
  exit 1
fi

if [ ! -x .kokoro-venv/bin/python ]; then
  "$PY" -m venv .kokoro-venv
fi
.kokoro-venv/bin/pip install -q --upgrade pip
.kokoro-venv/bin/pip install -q "kokoro-onnx==0.6.1" "soundfile>=0.12"

mkdir -p .kokoro
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
fetch() {
  local file=$1 sum=$2
  if [ -f ".kokoro/$file" ] && echo "$sum  .kokoro/$file" | shasum -a 256 -c --status; then
    echo "✓ .kokoro/$file"
    return
  fi
  echo "Downloading $file …"
  curl -fL --progress-bar -o ".kokoro/$file" "$BASE/$file"
  echo "$sum  .kokoro/$file" | shasum -a 256 -c
}
fetch kokoro-v1.0.onnx 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
fetch voices-v1.0.bin bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d
echo "Kokoro ready. Try: npm run voice -- --samples"
