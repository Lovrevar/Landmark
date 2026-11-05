#!/usr/bin/env python3
"""Mix one noise recording into every clean take at a fixed SNR.

    python3 mix_noise.py --clean clean --noise noise.wav --out noisy [--snr-db 10]

The default, 10 dB, is the frozen value from the plan's phase 0 protocol.

Deterministic by construction: same inputs, byte-identical outputs.
  * The noise offset for each take comes from SHA-256 of the file NAME
    (not its path or mtime), so it does not depend on where the tree lives.
  * All arithmetic is float64 numpy on the whole signal; output is rounded to
    16-bit PCM with np.rint and written with the stdlib `wave` module, which
    puts no timestamps or metadata in the file.
  * Files are processed in sorted order; a mix_log.csv records what was done.

SNR definition (the protocol's "speech RMS vs noise RMS"):
  * speech RMS = RMS of the clean take over its ACTIVE frames only (20 ms
    frames within 30 dB of the loudest frame and above -60 dBFS), so the
    pre-/post-roll silence the recorder keeps does not dilute the speech level;
  * noise RMS  = RMS of the exact noise segment that gets added (whole segment);
  * the noise is scaled so 20*log10(speech_rms / scaled_noise_rms) == --snr-db.
If the mix would clip, speech and noise are attenuated TOGETHER (SNR is kept)
and the attenuation is logged.

Input format: 16 kHz, mono, 16-bit PCM for both clean takes and noise. Convert
the noise track first if needed:
    ffmpeg -i site.mp3 -ac 1 -ar 16000 -sample_fmt s16 noise.wav
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import sys
import wave
from pathlib import Path

import numpy as np

RATE = 16000
FRAME = 320  # 20 ms at 16 kHz
ACTIVE_RANGE_DB = 30.0
ACTIVE_FLOOR_DBFS = -60.0
PEAK_LIMIT = 32767 / 32768


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
            raise ValueError(
                f"{path}: expected 16 kHz mono 16-bit PCM, got "
                f"{w.getframerate()} Hz, {w.getnchannels()} ch, {8 * w.getsampwidth()}-bit"
            )
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0


def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = np.clip(np.rint(x * 32768.0), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def speech_rms(x: np.ndarray) -> float:
    n = len(x) // FRAME
    if n == 0:
        raise ValueError("take shorter than one 20 ms frame")
    frames = x[: n * FRAME].reshape(n, FRAME)
    energy = np.mean(frames**2, axis=1)
    db = 10.0 * np.log10(np.maximum(energy, 1e-20))
    active = db >= max(db.max() - ACTIVE_RANGE_DB, ACTIVE_FLOOR_DBFS)
    if not active.any():
        raise ValueError("no active speech frames (silent take?)")
    return float(np.sqrt(np.mean(frames[active] ** 2)))


def noise_segment(noise: np.ndarray, length: int, name: str) -> tuple[np.ndarray, int]:
    digest = int.from_bytes(hashlib.sha256(name.encode("utf-8")).digest()[:8], "big")
    if len(noise) >= length:
        offset = digest % (len(noise) - length + 1)
        return noise[offset : offset + length], offset
    offset = digest % len(noise)  # noise shorter than the take: tile it, deterministically
    return np.resize(np.roll(noise, -offset), length), offset


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clean", type=Path, default=Path("clean"))
    ap.add_argument("--noise", type=Path, default=Path("noise.wav"))
    ap.add_argument("--out", type=Path, default=Path("noisy"))
    ap.add_argument("--snr-db", type=float, default=10.0, help="frozen protocol value: 10 dB")
    args = ap.parse_args()

    noise = read_wav(args.noise)
    noise_rms_total = float(np.sqrt(np.mean(noise**2)))
    if noise_rms_total == 0.0:
        print(f"{args.noise}: noise file is silent", file=sys.stderr)
        return 1
    args.out.mkdir(parents=True, exist_ok=True)
    takes = sorted(p for p in args.clean.glob("*.wav"))
    if not takes:
        print(f"no .wav files in {args.clean}/", file=sys.stderr)
        return 1

    log_rows = []
    failures = 0
    for path in takes:
        try:
            clean = read_wav(path)
            s_rms = speech_rms(clean)
            seg, offset = noise_segment(noise, len(clean), path.name)
            n_rms = float(np.sqrt(np.mean(seg**2)))
            if n_rms == 0.0:
                raise ValueError("selected noise segment is silent")
            gain = s_rms / (n_rms * 10.0 ** (args.snr_db / 20.0))
            mix = clean + gain * seg
            peak = float(np.max(np.abs(mix)))
            attenuation = 1.0
            if peak > PEAK_LIMIT:
                attenuation = PEAK_LIMIT / peak
                mix = mix * attenuation
            write_wav(args.out / path.name, mix)
            achieved = 20.0 * np.log10(s_rms / (gain * n_rms))
            log_rows.append({
                "file": path.name,
                "noise_offset": offset,
                "speech_rms": f"{s_rms:.8f}",
                "noise_gain": f"{gain:.8f}",
                "attenuation": f"{attenuation:.8f}",
                "snr_db": f"{achieved:.4f}",
            })
        except Exception as exc:  # report and continue: one bad take must not stop the batch
            failures += 1
            print(f"{path.name}: {exc}", file=sys.stderr)

    with open(args.out / "mix_log.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(log_rows[0]) if log_rows else ["file"], lineterminator="\n")
        w.writeheader()
        w.writerows(log_rows)
    print(f"mixed {len(log_rows)} take(s) at {args.snr_db:g} dB SNR into {args.out}/ ({failures} failed)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
