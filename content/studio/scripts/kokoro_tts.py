"""Kokoro text-to-speech bridge for scripts/voice.mjs.

Reads a JSON list of jobs on stdin:
  [{"text": "...", "out": "/abs/path.wav", "voice": "bm_george", "speed": 1.05, "lang": "en-gb"}]
and writes one 24 kHz mono WAV per job. Runs on CPU via kokoro-onnx (Apache-2.0 model + code).
Model files live in studio/.kokoro/ (npm run voice:setup downloads them).
"""
import json
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

here = os.path.dirname(os.path.abspath(__file__))
models = os.path.join(here, "..", ".kokoro")
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))

jobs = json.load(sys.stdin)
for job in jobs:
    samples, rate = k.create(job["text"], voice=job["voice"], speed=job.get("speed", 1.0), lang=job.get("lang", "en-gb"))
    sf.write(job["out"], samples, rate, subtype="PCM_16")
    print(json.dumps({"out": job["out"], "sec": round(len(samples) / rate, 2)}), flush=True)
