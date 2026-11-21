"""Audio helpers for scripts/voice.mjs. Reads JSON on stdin, subcommand in argv[1].

Everything here is sound design made from scratch in code: **no music, notes, melodies or composition** (Zoran's
rule), no samples, nothing to license. Tones only appear where the real machine makes them (a modem's handshake, a
CRT's whine, mains hum).

  polish  [{"in", "out", "stretch"}]   Shorter hesitations, optional speed-up without changing pitch, light EQ and
                                       compression. Loudness and edge trimming happen afterwards in lib/audio.mjs.
  robot   [{"in", "out", "text", "role", "marks", "amount", "glitch"}]
                                       The machine narrator. Transcribes the clean line (faster-whisper, word
                                       timestamps) to check it says what the script says, then makes it robotic
                                       (50 Hz ring mod, sub-octave double, bit-crush, metallic comb) and breaks it
                                       down on chosen words: stutters, pitch breaks, tape-wobble, digital dropouts.
                                       Brand words ("Fives Finder dot com", "free") are never glitched, and end-card
                                       lines only glitch where the script marks a word with ~tildes~.
                                       Prints one JSON line per job: check score, what was heard, glitches applied.
  check   [{"file", "text"}]           Transcript check only (used when "robot" is off).
  sfx     {"dir"}                      Writes the retro-tech effect library (sfx/<name>.wav, 48 kHz mono): crt-on,
                                       crt-off, static-hit, glitch-burst, dialup, im-alert, hdd-seek, servo, relay,
                                       alien-sweep, data-chirp, power-down.
  bed     {"out", "sec"}               "machine" room tone for under the voice: fan noise, 50 Hz mains hum, CRT
                                       whine, a hard drive ticking now and then, rare data chirps. No rhythm.

pedalboard (Spotify, GPL-3.0) and faster-whisper (MIT) are used as tools only; nothing of them ends up in the posts.
"""
import hashlib
import json
import os
import re
import sys
from difflib import SequenceMatcher

import numpy as np
import soundfile as sf

SR = 48000

# ---------------------------------------------------------------- small DSP helpers


def _t(sec, r=SR):
    return np.arange(int(sec * r)) / r


def _peak(x, db):
    return (x * (10 ** (db / 20) / max(1e-9, np.abs(x).max()))).astype(np.float32)


def _fade(x, r=SR, fi=0.003, fo=0.01):
    x = x.copy()
    a, b = min(len(x), int(fi * r)), min(len(x), int(fo * r))
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def _filt(x, r, hp=None, lp=None, order=2):
    from pedalboard import HighpassFilter, LowpassFilter, Pedalboard

    fx = []
    for _ in range(order):
        if hp:
            fx.append(HighpassFilter(hp))
        if lp:
            fx.append(LowpassFilter(lp))
    return Pedalboard(fx)(x[None].astype(np.float32), r)[0] if fx else x


def _sweep(f0, f1, sec, r=SR, log=True):
    n = int(sec * r)
    f = np.geomspace(f0, f1, n) if log else np.linspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / r), f


def _crush(x, r=SR, bits=6, rate=8000):
    from pedalboard import Bitcrush, Pedalboard, Resample

    return Pedalboard([Resample(target_sample_rate=rate), Bitcrush(bit_depth=bits)])(x[None].astype(np.float32), r)[0]


def _place(buf, x, at, r=SR):
    i = int(at * r)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def _click(rng, r=SR, ms=3, hp=1500):
    x = rng.standard_normal(int(ms / 1000 * r)) * np.exp(-np.arange(int(ms / 1000 * r)) / (0.0008 * r))
    return _filt(x, r, hp=hp, order=1)


def _seed(s):
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)


# ---------------------------------------------------------------- polish (unchanged behaviour)


def squeeze_pauses(a, rate, longest=0.22, keep=0.16, floor_db=-38):
    fr = int(0.01 * rate)
    quiet = np.array([np.abs(a[i : i + fr]).max() < 10 ** (floor_db / 20) for i in range(0, len(a), fr)])
    out, i = [], 0
    while i < len(quiet):
        j = i
        while j < len(quiet) and quiet[j] == quiet[i]:
            j += 1
        seg = a[i * fr : j * fr]
        if quiet[i] and (j - i) * 0.01 > longest:
            half = int(keep / 2 * rate)
            seg = np.concatenate([seg[:half], seg[-half:]])
        out.append(seg)
        i = j
    return np.concatenate(out)


def polish(jobs):
    from pedalboard import Compressor, HighpassFilter, HighShelfFilter, Pedalboard, PeakFilter, time_stretch

    chain = Pedalboard([
        HighpassFilter(90),
        PeakFilter(250, -2.0, 1.0),
        PeakFilter(3500, 3.0, 0.9),
        HighShelfFilter(9000, 2.0),
        Compressor(threshold_db=-20, ratio=3, attack_ms=4, release_ms=90),
    ])
    for j in jobs:
        a, rate = sf.read(j["in"], dtype="float32")
        a = squeeze_pauses(a, rate)
        if j.get("stretch", 1.0) != 1.0:
            a = time_stretch(a[None], rate, j["stretch"])[0].astype(np.float32)
        a = chain(a[None], rate)[0]
        a *= 0.89 / max(1e-6, np.abs(a).max())
        sf.write(j["out"], a, rate, subtype="PCM_16")


# ---------------------------------------------------------------- transcript check

NUMBER_WORDS = set(
    "zero oh one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen "
    "eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand".split()
)
PROTECT = ("fives", "finder", "dot", "com", "free")


def _plain(s):
    s = s.lower().replace("organizer", "organiser").replace(".com", " dot com")
    return "".join(w for w in re.split(r"[^a-z0-9]+", s) if w and not w.isdigit() and w not in NUMBER_WORDS)


def _word(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


_model = None


def _whisper():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel("small.en", device="cpu", compute_type="int8")
    return _model


def _transcribe(a, rate, words=False):
    x = np.interp(np.arange(0, len(a), rate / 16000), np.arange(len(a)), a).astype(np.float32)
    segs = list(_whisper().transcribe(x, beam_size=1, language="en", word_timestamps=words)[0])
    heard = " ".join(s.text for s in segs).strip()
    ws = [(w.word, w.start, w.end) for s in segs for w in (s.words or [])] if words else []
    return heard, ws


def _score(text, heard):
    want, got = _plain(text), _plain(heard)
    score = SequenceMatcher(None, want, got).ratio()
    brand_ok = "fivesfinder" not in want or "fivesfinder" in got
    return round(score, 2), score >= 0.9 and brand_ok


def check(jobs):
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return
    for j in jobs:
        a, rate = sf.read(j["file"], dtype="float32")
        heard, _ = _transcribe(a, rate)
        score, ok = _score(j["text"], heard)
        print(json.dumps({"file": j["file"], "score": score, "ok": ok, "heard": heard}), flush=True)


# ---------------------------------------------------------------- the machine narrator


def robotize(a, r, amount):
    """Clearly a machine, still easy to follow: 50 Hz ring mod (Cape Town's mains), a sub-octave double,
    a bit-crushed layer and a short metallic comb."""
    from pedalboard import Compressor, Delay, Pedalboard, PitchShift

    if amount <= 0:
        return a
    t = np.arange(len(a)) / r
    ring = a * np.sin(2 * np.pi * 50 * t)
    low = PitchShift(semitones=-12)(a[None], r)[0][: len(a)]
    crushed = _crush(a, r, bits=8, rate=11025)[: len(a)]
    # Ring mod (the warble) and sub-octave (the rumble) were dialled back on Zoran's ear test (21 Nov): 0.6 → 0.35, 0.3 → 0.15.
    y = a * (1 - 0.3 * amount) + ring * 0.35 * amount + low * 0.15 * amount + crushed * 0.3 * amount
    y = Pedalboard([Delay(delay_seconds=0.0045, feedback=0.4 * amount, mix=0.3 * amount)])(y[None].astype(np.float32), r)[0]
    y = _filt(y, r, hp=150, lp=7500, order=1)
    return Pedalboard([Compressor(threshold_db=-22, ratio=4, attack_ms=3, release_ms=60)])(y[None].astype(np.float32), r)[0]


def _xfade_replace(y, s, e, new, r, ms=6):
    n = int(ms / 1000 * r)
    new = new.astype(np.float32).copy()
    if len(new) > 2 * n:
        new[:n] *= np.linspace(0, 1, n)
        new[-n:] *= np.linspace(1, 0, n)
    return np.concatenate([y[:s], new, y[e:]])


def _varispeed(seg, rate_curve):
    """Read `seg` at a changing speed (1 = normal, 0.5 = half speed, an octave down). Pitch and time move together,
    like a tape or a dying hard drive."""
    pos, out, i = 0.0, [], 0
    n = len(seg)
    while pos < n - 1:
        rc = rate_curve(pos / n)
        out.append(pos)
        pos += max(0.05, rc)
        i += 1
        if i > n * 20:
            break
    out = np.array(out)
    return np.interp(out, np.arange(n), seg).astype(np.float32)


def g_stutter(y, s, e, r, rng):
    head = y[s : s + int(min(0.1, max(0.05, (e - s) / r * 0.45)) * r)]
    k = int(rng.integers(2, 5))
    rep = _fade(_crush(head, r, bits=7, rate=16000)[: len(head)] * 1.1, r, 0.002, 0.006)
    gap = np.zeros(int(0.014 * r), np.float32)
    return np.concatenate([y[:s], np.tile(np.concatenate([rep, gap]), k), y[s:]])


def g_pitchbreak(y, s, e, r, rng):
    from pedalboard import PitchShift

    semis = float(rng.choice([-9, -7, -5, 5, 7]))
    seg = PitchShift(semitones=semis)(y[s:e][None], r)[0][: e - s]
    seg = 0.8 * seg + 0.35 * _crush(seg, r, bits=6, rate=11025)[: len(seg)]
    return _xfade_replace(y, s, e, seg, r)


def g_wow(y, s, e, r, rng):
    depth = float(rng.uniform(0.35, 0.55))
    seg = _varispeed(y[s:e], lambda u: 1 - depth * np.sin(np.pi * u))
    return _xfade_replace(y, s, e, seg, r)


def g_tapestop(y, s, e, r, rng):
    # Winds down to about 13.5 semitones lower (Zoran, 21 Nov: ~18 was inaudible, ~9 cut off too quickly), and lets
    # the end of the word ring out over 0.12 s instead of stopping dead.
    seg = _varispeed(y[s:e], lambda u: max(0.46, 1 - 0.54 * u**1.5))
    rms = lambda x: np.sqrt((x**2).mean()) + 1e-9
    seg = seg * (rms(y[:s]) / rms(seg)) * 1.12  # as loud as the rest of the line (+1 dB): lower pitch sounds quieter
    return np.concatenate([y[:s], _fade(seg, r, 0.002, 0.12)])


def g_dropout(y, s, e, r, rng):
    mid = s + (e - s) // 2
    n = int(0.05 * r)
    burst = _crush(rng.standard_normal(int(0.02 * r)).astype(np.float32) * 0.12, r, bits=3, rate=6000)
    hole = np.zeros(n - len(burst), np.float32)
    return np.concatenate([y[:mid], _click(rng, r) * 0.4, burst, hole, y[mid + n :]])


GLITCHES = {"stutter": g_stutter, "pitch": g_pitchbreak, "wow": g_wow, "dropout": g_dropout}


def robot(jobs):
    """Check each clean line, then make it robotic and break it down on a few words."""
    for j in jobs:
        a, r = sf.read(j["in"], dtype="float32")
        rng = np.random.default_rng(_seed(j["text"]))
        try:
            heard, words = _transcribe(a, r, words=True)
            score, ok = _score(j["text"], heard)
        except ImportError:
            heard, words, score, ok = "", [], None, True
        amount, glitch, role = float(j.get("amount", 0.6)), float(j.get("glitch", 0.6)), j.get("role", "beat")
        y = robotize(a, r, amount)

        # Which words. If the script marks any (~word~ or ~word:stutter~), only those glitch: an approved take never
        # changes. Otherwise a few are picked (never the first word, short words, brand words or the end card).
        idx = [(_word(w), int(s * r), int(e * r)) for w, s, e in words]
        kinds = {}
        k = 0
        for m in j.get("marks", []):
            mw, _, mk = m.partition(":")
            mw = _word(mw)
            while k < len(idx) and not (idx[k][0] == mw or idx[k][0].startswith(mw)):
                k += 1
            if k < len(idx):
                kinds[k] = mk or None
                k += 1
        if j.get("marks"):
            picks = list(kinds)
        else:
            ok_word = lambda i: i > 0 and (idx[i][2] - idx[i][1]) / r >= 0.12 and not any(p in idx[i][0] for p in PROTECT)
            pool = [i for i in range(len(idx)) if ok_word(i)]
            n = 0 if role == "end" else int(glitch * 1.4 + rng.random())
            if role == "hook" and glitch > 0:
                n = max(n, 1)
            # Rank by a hash of the word itself, not a random draw, so tiny timing differences between runs
            # don't move the glitches to other words.
            pool.sort(key=lambda i: _seed(f"{j['text']}|{idx[i][0]}|{i}"))
            picks = pool[:n]
        events = []
        for i in sorted(set(int(p) for p in picks), reverse=True):  # last first, so earlier positions stay valid
            w, s, e = idx[i]
            wr = np.random.default_rng(_seed(f"{j['text']}|{w}|{i}"))
            last = i == len(idx) - 1
            kind = kinds.get(i) or ("tapestop" if last and role == "beat" and wr.random() < 0.5 else str(wr.choice(list(GLITCHES), p=[0.35, 0.3, 0.2, 0.15])))
            if kind not in GLITCHES and kind != "tapestop":
                kind = "stutter"
            y = (g_tapestop if kind == "tapestop" else GLITCHES[kind])(y, s, min(e, len(y)), r, wr)
            events.append({"word": words[i][0].strip(), "glitch": kind})
        y = (y * (0.89 / max(1e-6, np.abs(y).max()))).astype(np.float32)
        sf.write(j["out"], y, r, subtype="PCM_16")
        print(json.dumps({"file": j["out"], "score": score, "ok": ok, "heard": heard, "glitches": events[::-1]}), flush=True)


# ---------------------------------------------------------------- retro-tech effects


def sfx_crt_on(rng):
    out = np.zeros(int(1.3 * SR), np.float32)
    t = _t(0.18)
    _place(out, (np.sin(2 * np.pi * 55 * t) * np.exp(-t * 22) * 0.9).astype(np.float32), 0)  # relay thunk
    _place(out, _click(rng, hp=800) * 0.9, 0)
    t = _t(1.0)
    buzz = np.sign(np.sin(2 * np.pi * 50 * t)) * 0.5 + np.sin(2 * np.pi * 100 * t) * 0.3  # degauss buzz
    _place(out, (_filt(buzz, SR, lp=1800) * np.exp(-t * 3.2) * (1 + 0.3 * np.sin(2 * np.pi * 7 * t)) * 0.45).astype(np.float32), 0.04)
    t = _t(1.2)
    whine = np.sin(2 * np.pi * 15734 * t) * np.minimum(1, t / 0.5) * 0.05  # line-output whine
    _place(out, whine.astype(np.float32), 0.1)
    crackle = np.zeros(int(0.5 * SR), np.float32)
    for _ in range(40):
        _place(crackle, _click(rng, hp=2500) * rng.uniform(0.05, 0.3), rng.uniform(0, 0.48))
    _place(out, crackle, 0.05)
    return _peak(_fade(out, SR, 0.001, 0.25), -3)


def sfx_crt_off(rng):
    pop = _click(rng, hp=300) * 1.0
    sw, _ = _sweep(4000, 60, 0.14)
    zap = sw * np.linspace(0.6, 0, len(sw))
    static = _filt(rng.standard_normal(int(0.3 * SR)), SR, hp=2000) * np.exp(-_t(0.3) * 14) * 0.25
    out = np.zeros(int(0.5 * SR), np.float32)
    _place(out, pop, 0)
    _place(out, zap.astype(np.float32), 0.005)
    _place(out, static.astype(np.float32), 0.02)
    return _peak(_fade(out), -4)


def sfx_static_hit(rng):
    n = int(0.32 * SR)
    x = _filt(rng.standard_normal(n), SR, hp=900, lp=9000) * np.exp(-_t(0.32) * 9)
    for _ in range(25):
        _place(x, _click(rng) * rng.uniform(0.2, 0.8), rng.uniform(0, 0.3))
    return _peak(_fade(_crush(x.astype(np.float32), SR, bits=5, rate=16000)), -5)


def sfx_glitch_burst(rng):
    parts = []
    for _ in range(int(rng.integers(9, 15))):
        d = rng.uniform(0.008, 0.04)
        kind = rng.integers(0, 3)
        t = _t(d)
        if kind == 0:
            x = np.sign(np.sin(2 * np.pi * rng.uniform(80, 2500) * t)) * 0.5
        elif kind == 1:
            x = rng.standard_normal(len(t)) * 0.4
        else:
            x = np.zeros(len(t))
        parts.append(_fade(x.astype(np.float32), SR, 0.0005, 0.0015))
    return _peak(_crush(np.concatenate(parts), SR, bits=4, rate=11025), -6)


def sfx_dialup(rng):
    tel = lambda x: _filt(x, SR, hp=300, lp=3400)
    out = []
    keypad = {"7": (852, 1209), "2": (697, 1336), "1": (697, 1209), "4": (770, 1209), "8": (852, 1336), "0": (941, 1336), "5": (770, 1336)}
    for d in "0217845":  # DTMF dialling
        lo, hi = keypad[d]
        t = _t(0.07)
        out += [np.sin(2 * np.pi * lo * t) * 0.4 + np.sin(2 * np.pi * hi * t) * 0.4, np.zeros(int(0.05 * SR))]
    out.append(np.zeros(int(0.25 * SR)))
    t = _t(0.55)  # answer tone with phase reversals
    ph = np.where((t % 0.45) < 0.225, 0, np.pi)
    out.append(np.sin(2 * np.pi * 2100 * t + ph) * 0.45)
    t = _t(0.35)  # FSK warble
    bits = rng.integers(0, 2, int(0.35 * 300))
    f = np.repeat(np.where(bits, 1180, 980), int(SR / 300))[: len(t)]
    out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4)
    t = _t(0.3)  # the "bong"
    out.append((np.sin(2 * np.pi * 1200 * t) + np.sin(2 * np.pi * 2400 * t) * 0.6) * 0.3 * np.exp(-t * 2))
    t = _t(1.1)  # training screech: shaped noise + phasing carriers
    screech = _filt(rng.standard_normal(len(t)), SR, hp=500, lp=3200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 33 * t)))
    screech += np.sin(2 * np.pi * (1800 + 600 * np.sign(np.sin(2 * np.pi * 9 * t))) * t) * 0.25
    out.append(screech * 0.35 * np.minimum(1, (1.1 - t) / 0.2))
    x = tel(np.concatenate([np.asarray(p, np.float32) for p in out]))
    return _peak(_fade(np.tanh(x * 2.5) * 0.6), -6)


def sfx_im_alert(rng):
    """An original early-2000s message alert: a soft pop and two quick rising glides (glides, not notes)."""
    out = np.zeros(int(0.32 * SR), np.float32)
    _place(out, _click(rng, hp=400) * 0.4, 0)
    for at, (a, b) in [(0.0, (620, 1150)), (0.11, (820, 1600))]:
        s, f = _sweep(a, b, 0.075)
        mod = np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * 0.6
        tone = np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * np.exp(-_t(0.075) * 18)
        _place(out, _fade(tone.astype(np.float32), SR, 0.002, 0.02) * 0.6, at)
    return _peak(out, -6)


def sfx_hdd_seek(rng):
    out = np.zeros(int(0.45 * SR), np.float32)
    for at in np.sort(rng.uniform(0, 0.38, int(rng.integers(6, 11)))):
        c = _filt(rng.standard_normal(int(0.004 * SR)), SR, hp=1800, lp=6000) * np.exp(-np.arange(int(0.004 * SR)) / (0.0009 * SR))
        _place(out, c.astype(np.float32) * rng.uniform(0.4, 1), at)
        t = _t(0.03)
        _place(out, (np.sin(2 * np.pi * 140 * t) * np.exp(-t * 120) * 0.25).astype(np.float32), at)
    spin = np.sin(2 * np.pi * 120 * _t(0.45)) * 0.04
    return _peak(_fade(out + spin.astype(np.float32)), -6)


def sfx_servo(rng):
    t = _t(0.6)
    f = 260 + 520 * np.sin(np.pi * np.minimum(1, t / 0.45)) ** 1.5
    saw = ((np.cumsum(f) / SR) % 1) * 2 - 1
    x = _filt(saw * (1 + 0.15 * rng.standard_normal(len(t))), SR, lp=3200) * np.minimum(1, (0.6 - t) / 0.08)
    out = np.concatenate([x, np.zeros(int(0.05 * SR))]).astype(np.float32)
    _place(out, _click(rng, hp=1200) * 0.6, 0.58)
    return _peak(_fade(out), -8)


def sfx_relay(rng):
    out = np.zeros(int(0.1 * SR), np.float32)
    _place(out, _click(rng, hp=900), 0)
    _place(out, _click(rng, hp=1400) * 0.7, 0.028)
    return _peak(out, -6)


def sfx_alien_sweep(rng):
    t = _t(1.3)
    car, f = _sweep(180, 1600, 1.3)
    mod = np.sin(2 * np.pi * 37 * t) * 4
    x = np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * np.sin(2 * np.pi * 113 * t)
    env = np.sin(np.pi * np.minimum(1, t / 1.3)) ** 0.7
    from pedalboard import Pedalboard, Phaser

    x = Pedalboard([Phaser(rate_hz=0.8, depth=0.8, mix=0.6)])((x * env * 0.5)[None].astype(np.float32), SR)[0]
    return _peak(_fade(x), -8)


def sfx_data_chirp(rng):
    parts = []
    for _ in range(int(rng.integers(12, 18))):
        d = rng.uniform(0.015, 0.035)
        parts += [np.sin(2 * np.pi * rng.uniform(1200, 4200) * _t(d)) * 0.4, np.zeros(int(rng.uniform(0.002, 0.012) * SR))]
    return _peak(_crush(_fade(np.concatenate(parts).astype(np.float32)), SR, bits=5, rate=16000), -9)


def sfx_power_down(rng):
    t = _t(1.0)
    f = 150 * np.exp(-t * 3.2) + 8
    saw = ((np.cumsum(f) / SR) % 1) * 2 - 1
    whine = np.sin(2 * np.pi * np.cumsum(3000 * np.exp(-t * 4) + 40) / SR) * 0.15
    x = _filt(saw * 0.6 + whine, SR, lp=2500) * np.minimum(1, (1.0 - t) / 0.3)
    out = np.concatenate([x, np.zeros(int(0.06 * SR))]).astype(np.float32)
    _place(out, _click(rng, hp=500) * 0.5, 0.98)
    return _peak(_fade(out), -6)


SFX = {
    "crt-on": sfx_crt_on,
    "crt-off": sfx_crt_off,
    "static-hit": sfx_static_hit,
    "glitch-burst": sfx_glitch_burst,
    "dialup": sfx_dialup,
    "im-alert": sfx_im_alert,
    "hdd-seek": sfx_hdd_seek,
    "servo": sfx_servo,
    "relay": sfx_relay,
    "alien-sweep": sfx_alien_sweep,
    "data-chirp": sfx_data_chirp,
    "power-down": sfx_power_down,
}


def sfx(job):
    os.makedirs(job["dir"], exist_ok=True)
    for name, fn in SFX.items():
        sf.write(os.path.join(job["dir"], f"{name}.wav"), fn(np.random.default_rng(_seed(name))), SR, subtype="PCM_16")
    print(json.dumps({"dir": job["dir"], "sfx": list(SFX)}), flush=True)


def bed(job):
    """Machine room tone. Irregular on purpose: no beat, no pulse, nothing you could tap along to."""
    sec = float(job.get("sec", 60))
    rng = np.random.default_rng(48)
    n = int(sec * SR)
    t = np.arange(n) / SR
    white = rng.standard_normal(n)
    pink = np.cumsum(white) * 0.02
    pink -= np.convolve(pink, np.ones(4800) / 4800, "same")  # tame the drift: brown-ish fan rumble
    fan = _filt(pink, SR, hp=40, lp=600) * 0.5
    hum = (np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 100 * t) + 0.3 * np.sin(2 * np.pi * 150 * t)) * 0.05
    hum *= 1 + 0.2 * np.sin(2 * np.pi * 0.13 * t)
    whine = np.sin(2 * np.pi * 15734 * t) * 0.006
    hiss = _filt(white, SR, hp=4000) * 0.01
    out = (fan + hum + whine + hiss).astype(np.float32)
    at = 0.0
    while at < sec - 1:  # the odd hard-drive seek, relay or data chirp, at random times
        at += rng.exponential(3.5)
        pick = rng.random()
        fx = sfx_hdd_seek(rng) * 0.25 if pick < 0.6 else sfx_relay(rng) * 0.2 if pick < 0.85 else sfx_data_chirp(rng) * 0.12
        _place(out, fx, at)
    out *= np.minimum(1, t / 0.4).astype(np.float32)
    try:
        import pyloudnorm as pyln

        out *= 10 ** ((-18 - pyln.Meter(SR).integrated_loudness(out)) / 20)
    except ImportError:
        out *= 0.1 / np.sqrt((out**2).mean())
    sf.write(job["out"], np.clip(out, -0.89, 0.89).astype(np.float32), SR, subtype="PCM_16")


if __name__ == "__main__":
    cmd, data = sys.argv[1], json.load(sys.stdin)
    {"polish": polish, "robot": robot, "check": check, "sfx": sfx, "bed": bed}[cmd](data)
