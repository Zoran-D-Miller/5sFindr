"""Chatterbox-Turbo text-to-speech bridge for scripts/voice.mjs (the "chatterbox" engine).

Chatterbox-Turbo is Resemble AI's 350M-parameter TTS (MIT licence), run here on the CPU through onnxruntime,
adapted from the example on huggingface.co/ResembleAI/chatterbox-turbo-ONNX. It speaks with far more natural
rhythm and emphasis than Kokoro. It needs a short reference clip for the *sound* of the voice: voice.mjs makes
that clip with Kokoro (so the timbre is one of Kokoro's Apache-2.0 voices, never a real person's).

Reads a JSON list of jobs on stdin:
  [{"text": "...", "out": "/abs/path.wav", "ref": "/abs/ref.wav"}]
and writes one 24 kHz mono WAV per job. Model files (~1 GB) are downloaded once into the Hugging Face cache
by `npm run voice:setup -- --chatterbox`.
Speed on an Intel i5 (4 cores): about 2.5x real time, so a week's lines take ~10 minutes.
"""
import json
import sys

import numpy as np
import onnxruntime as ort
import soundfile as sf
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer

MODEL = "ResembleAI/chatterbox-turbo-ONNX"
RATE = 24000
START, STOP, SILENCE = 6561, 6562, 4299
KV_HEADS, HEAD_DIM = 16, 64
# The 8-bit language model is ~10x slower than the 4-bit one on Intel CPUs (0.8 s vs 0.09 s per token);
# the other three parts are fine at 8-bit.
DTYPES = {"language_model": "q4"}


def graph(name):
    fname = f"{name}_{DTYPES.get(name, 'quantized')}.onnx"
    path = hf_hub_download(MODEL, fname, subfolder="onnx")
    hf_hub_download(MODEL, fname + "_data", subfolder="onnx")
    return path


def load():
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    sessions = [ort.InferenceSession(graph(n), opts) for n in ["speech_encoder", "embed_tokens", "language_model", "conditional_decoder"]]
    return sessions, Tokenizer.from_file(hf_hub_download(MODEL, "tokenizer.json"))


def penalise(ids, scores, penalty=1.2):
    s = np.take_along_axis(scores, ids, 1)
    s = np.where(s < 0, s * penalty, s / penalty)
    out = scores.copy()
    np.put_along_axis(out, ids, s, 1)
    return out


def main():
    (enc, emb, lm, dec), tok = load()
    refs = {}
    for job in json.load(sys.stdin):
        if job["ref"] not in refs:
            audio, sr = sf.read(job["ref"], dtype="float32")
            if sr != RATE:
                raise SystemExit(f"reference clip must be {RATE} Hz: {job['ref']}")
            refs[job["ref"]] = enc.run(None, {"audio_values": audio[None, :]})
        cond, prompt_tokens, spk_emb, spk_feat = refs[job["ref"]]

        ids = np.array([tok.encode(job["text"]).ids], dtype=np.int64)
        generated = np.array([[START]], dtype=np.int64)
        for step in range(1500):
            x = emb.run(None, {"input_ids": ids})[0]
            if step == 0:
                x = np.concatenate((cond, x), 1)
                batch, length, _ = x.shape
                past = {
                    i.name: np.zeros([batch, KV_HEADS, 0, HEAD_DIM], dtype=np.float16 if i.type == "tensor(float16)" else np.float32)
                    for i in lm.get_inputs()
                    if "past_key_values" in i.name
                }
                mask = np.ones((batch, length), np.int64)
                pos = np.arange(length, dtype=np.int64)[None]
            logits, *present = lm.run(None, dict(inputs_embeds=x, attention_mask=mask, position_ids=pos, **past))
            ids = np.argmax(penalise(generated, logits[:, -1, :]), -1, keepdims=True).astype(np.int64)
            generated = np.concatenate((generated, ids), -1)
            if ids[0, 0] == STOP:
                break
            mask = np.concatenate([mask, np.ones((batch, 1), np.int64)], 1)
            pos = pos[:, -1:] + 1
            for j, k in enumerate(past):
                past[k] = present[j]

        speech = np.concatenate([prompt_tokens, generated[:, 1:-1], np.full((1, 3), SILENCE, np.int64)], 1)
        wav = dec.run(None, dict(speech_tokens=speech, speaker_embeddings=spk_emb, speaker_features=spk_feat))[0].squeeze(0)
        sf.write(job["out"], wav, RATE, subtype="PCM_16")
        print(json.dumps({"out": job["out"], "sec": round(len(wav) / RATE, 2)}), flush=True)


if __name__ == "__main__":
    main()
