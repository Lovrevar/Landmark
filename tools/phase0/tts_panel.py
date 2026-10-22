#!/usr/bin/env python3
"""Generate the phase 0 TTS listening panel: every sentence in tts_sentences.csv
spoken by every voice in tts_voices.csv, as loudness-matched 24 kHz mono WAV
clips with opaque names, plus panel_manifest.csv for rate.html and tts_score.py.

    python3 tts_panel.py --out /mnt/c/phase0/tts [--configs az_gabrijela gc_f ...] [--dry-run]
    python3 tts_panel.py --list-voices google|azure|elevenlabs

Blind: a clip's file name is a hash of (config, sentence), so neither the name nor
the rating order says which voice it is.

Loudness: every clip is scaled to the same speech RMS (-20 dBFS, peaks kept under
-1 dBFS), so no voice wins by being louder.

Timing: first_byte_ms and total_ms are recorded per request. ElevenLabs streams;
Azure and Google return whole files, so their first byte is close to the total.
Only the live prototype measures real time-to-first-audio.

Credentials (environment):
  ElevenLabs: ELEVENLABS_API_KEY with the text-to-speech permission.
  Azure:      AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (an EU region, e.g. westeurope).
  Google:     GOOGLE_TTS_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS (service account).

Resumable: a clip already on disk is skipped, so re-running retries only failures,
which are logged to tts_errors.log in --out.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import os
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np

from mix_noise import speech_rms  # 320-sample frames: 13 ms at 24 kHz, fine for matching loudness

HERE = Path(__file__).resolve().parent
RATE = 24000
TARGET_RMS_DBFS = -20.0
PEAK_LIMIT_DBFS = -1.0
MANIFEST_COLS = ["clip_id", "config_id", "sentence_id", "block", "kind", "text", "vendor", "model", "voice",
                 "first_byte_ms", "total_ms", "audio_ms", "gain_db", "generated_at"]


def clip_id(config_id: str, sentence_id: str) -> str:
    return hashlib.sha256(f"tts-panel|{config_id}|{sentence_id}".encode()).hexdigest()[:12]


def read_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def http(method: str, url: str, headers: dict[str, str], body: bytes | None = None,
         timeout: float = 60) -> tuple[bytes, int, int]:
    """(response body, ms to the first byte, ms to the last byte)."""
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            first = resp.read(1)
            t_first = time.monotonic()
            data = first + resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:400].decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {exc.code} from {urllib.parse.urlsplit(url).netloc}: {detail}") from None
    t_end = time.monotonic()
    return data, round((t_first - t0) * 1000), round((t_end - t0) * 1000)


def wav_samples(data: bytes) -> np.ndarray:
    with wave.open(io.BytesIO(data), "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
            raise ValueError(f"expected 24 kHz mono 16-bit WAV, got {w.getframerate()} Hz, "
                             f"{w.getnchannels()} ch, {8 * w.getsampwidth()}-bit")
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")


def normalized(samples: np.ndarray) -> tuple[np.ndarray, float]:
    """Scale to TARGET_RMS_DBFS speech RMS, lowered if that would push a peak past PEAK_LIMIT_DBFS."""
    x = samples.astype(np.float64) / 32768.0
    gain = 10 ** (TARGET_RMS_DBFS / 20) / speech_rms(x)
    peak = float(np.max(np.abs(x))) or 1.0
    gain = min(gain, 10 ** (PEAK_LIMIT_DBFS / 20) / peak)
    return np.round(x * gain * 32767).astype("<i2"), 20 * np.log10(gain)


def write_wav(path: Path, samples: np.ndarray) -> None:
    tmp = path.with_suffix(".tmp")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.tobytes())
    tmp.replace(path)  # a clip on disk is always complete, which is what resuming relies on


# ---------------------------------------------------------------------------
# Vendors. Each request builder is pure (url, headers, body) so the self-test can
# check it; synthesize() sends it and returns 24 kHz mono samples.
# ---------------------------------------------------------------------------

def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is not set")
    return value


def elevenlabs_request(base: str, key: str, model: str, voice: str, extra: dict, text: str):
    url = f"{base}/v1/text-to-speech/{urllib.parse.quote(voice)}/stream?output_format=pcm_24000"
    body = {"text": text, "model_id": model, **extra}
    return url, {"xi-api-key": key, "Content-Type": "application/json"}, json.dumps(body).encode()


def azure_request(endpoint: str, key: str, voice: str, text: str):
    ssml = (f"<speak version='1.0' xml:lang='hr-HR'><voice name='{escape(voice, {chr(39): '&apos;'})}'>"
            f"{escape(text)}</voice></speak>")
    headers = {"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
               "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "cognilion-phase0-tts-panel"}
    return f"{endpoint}/cognitiveservices/v1", headers, ssml.encode("utf-8")


def google_request(endpoint: str, auth: dict[str, str], voice: str, text: str):
    """`auth` is {"key": ...} or {"Authorization": ..., optional "x-goog-user-project": ...}."""
    body = {"input": {"text": text}, "voice": {"languageCode": "hr-HR", "name": voice},
            "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": RATE}}
    url = f"{endpoint}/v1/text:synthesize"
    headers = {"Content-Type": "application/json"}
    if "key" in auth:
        url += "?" + urllib.parse.urlencode({"key": auth["key"]})
    else:
        headers.update(auth)
    return url, headers, json.dumps(body).encode()


class Vendors:
    def __init__(self, args):
        self.args = args
        self._lock = threading.Lock()
        self._google_creds = None

    def google_auth(self) -> dict[str, str]:
        if os.environ.get("GOOGLE_TTS_API_KEY"):
            return {"key": os.environ["GOOGLE_TTS_API_KEY"]}
        import google.auth
        import google.auth.transport.requests

        with self._lock:
            if self._google_creds is None:
                self._google_creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            if not self._google_creds.valid:
                self._google_creds.refresh(google.auth.transport.requests.Request())
            auth = {"Authorization": f"Bearer {self._google_creds.token}"}
            if getattr(self._google_creds, "quota_project_id", None):
                auth["x-goog-user-project"] = self._google_creds.quota_project_id
            return auth

    def azure_endpoint(self) -> str:
        return self.args.azure_endpoint or f"https://{required_env('AZURE_SPEECH_REGION')}.tts.speech.microsoft.com"

    def synthesize(self, cfg: dict, text: str) -> tuple[np.ndarray, int, int]:
        vendor = cfg["vendor"]
        if vendor == "elevenlabs":
            extra = json.loads(cfg["extra"]) if cfg.get("extra") else {}
            req = elevenlabs_request(self.args.elevenlabs_url, required_env("ELEVENLABS_API_KEY"),
                                     cfg["model"], cfg["voice"], extra, text)
            data, first, total = http("POST", *req)
            if len(data) % 2:
                raise ValueError("ElevenLabs returned an odd number of PCM bytes")
            return np.frombuffer(data, dtype="<i2"), first, total
        if vendor == "azure":
            data, first, total = http("POST", *azure_request(self.azure_endpoint(), required_env("AZURE_SPEECH_KEY"),
                                                             cfg["voice"], text))
            return wav_samples(data), first, total
        if vendor == "google":
            data, first, total = http("POST", *google_request(self.args.google_endpoint, self.google_auth(),
                                                              cfg["voice"], text))
            return wav_samples(base64.b64decode(json.loads(data)["audioContent"])), first, total
        raise ValueError(f"unknown vendor {vendor!r} in tts_voices.csv")

    def list_voices(self, vendor: str) -> list[str]:
        if vendor == "google":
            auth = self.google_auth()
            url = f"{self.args.google_endpoint}/v1/voices?languageCode=hr-HR"
            headers = {}
            if "key" in auth:
                url += "&" + urllib.parse.urlencode({"key": auth["key"]})
            else:
                headers.update(auth)
            data, _, _ = http("GET", url, headers)
            return [f"{v['name']:40s} {v.get('ssmlGender', '')}" for v in json.loads(data).get("voices", [])]
        if vendor == "azure":
            data, _, _ = http("GET", f"{self.azure_endpoint()}/cognitiveservices/voices/list",
                              {"Ocp-Apim-Subscription-Key": required_env("AZURE_SPEECH_KEY")})
            return [f"{v['ShortName']:40s} {v.get('Gender', '')}" for v in json.loads(data) if v.get("Locale") == "hr-HR"]
        if vendor == "elevenlabs":
            url = f"{self.args.elevenlabs_url}/v1/shared-voices?" + urllib.parse.urlencode({"language": "hr", "page_size": 50})
            data, _, _ = http("GET", url, {"xi-api-key": required_env("ELEVENLABS_API_KEY")})
            return [f"{v.get('voice_id', '')}  {v.get('name', '')}  ({v.get('gender', '')}, {v.get('accent', '')}, "
                    f"{v.get('language', '')})" for v in json.loads(data).get("voices", [])]
        raise SystemExit(f"--list-voices: unknown vendor {vendor!r}")


# ---------------------------------------------------------------------------

def done_clips(manifest: Path, clips: Path) -> set[str]:
    if not manifest.exists():
        return set()
    return {r["clip_id"] for r in read_csv(manifest) if (clips / f"{r['clip_id']}.wav").exists()}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, help="panel folder: clips/, panel_manifest.csv (keep it outside the repo)")
    ap.add_argument("--sentences", type=Path, default=HERE / "tts_sentences.csv")
    ap.add_argument("--voices", type=Path, default=HERE / "tts_voices.csv")
    ap.add_argument("--configs", nargs="+", help="only these config_ids (default: every row with a voice)")
    ap.add_argument("--blocks", nargs="+", choices=["gate", "digits"], default=["gate", "digits"])
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true", help="list what would be generated, call nothing")
    ap.add_argument("--list-voices", choices=["google", "azure", "elevenlabs"],
                    help="print the Croatian voices a vendor offers, then exit")
    ap.add_argument("--elevenlabs-url", default="https://api.elevenlabs.io")
    ap.add_argument("--azure-endpoint", help="default https://$AZURE_SPEECH_REGION.tts.speech.microsoft.com")
    ap.add_argument("--google-endpoint", default="https://eu-texttospeech.googleapis.com",
                    help="EU endpoint by default; the global one is https://texttospeech.googleapis.com")
    args = ap.parse_args()
    vendors = Vendors(args)

    if args.list_voices:
        for line in vendors.list_voices(args.list_voices):
            print(line)
        return 0
    if not args.out:
        ap.error("--out is required")

    sentences = [s for s in read_csv(args.sentences) if s["block"] in args.blocks]
    configs = read_csv(args.voices)
    if args.configs:
        unknown = set(args.configs) - {c["config_id"] for c in configs}
        if unknown:
            ap.error(f"unknown config_id(s): {', '.join(sorted(unknown))}")
        configs = [c for c in configs if c["config_id"] in args.configs]
    skipped = [c["config_id"] for c in configs if not c["voice"].strip()]
    configs = [c for c in configs if c["voice"].strip()]

    clips = args.out / "clips"
    manifest = args.out / "panel_manifest.csv"
    done = done_clips(manifest, clips)
    tasks = [(c, s) for c in configs for s in sentences if clip_id(c["config_id"], s["sentence_id"]) not in done]
    print(f"{len(configs)} voice(s) x {len(sentences)} sentence(s); {len(done)} clips already done; {len(tasks)} to generate"
          + (f"; skipped (no voice set in tts_voices.csv): {', '.join(skipped)}" if skipped else ""))
    if args.dry_run or not tasks:
        for c, s in tasks[:10]:
            print(f"  {c['config_id']:14s} {s['sentence_id']}  {s['text']}")
        return 0

    clips.mkdir(parents=True, exist_ok=True)
    lock = threading.Lock()
    new_file = not manifest.exists()
    out_f = open(manifest, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(out_f, fieldnames=MANIFEST_COLS, lineterminator="\n")
    if new_file:
        writer.writeheader()
    err_log = open(args.out / "tts_errors.log", "a", encoding="utf-8")

    def run(task) -> str | None:
        cfg, s = task
        cid = clip_id(cfg["config_id"], s["sentence_id"])
        try:
            samples, first, total = vendors.synthesize(cfg, s["text"])
            level, gain_db = normalized(samples)
            write_wav(clips / f"{cid}.wav", level)
        except Exception as exc:
            with lock:
                err_log.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {cfg['config_id']} {s['sentence_id']}: {exc}\n"
                              f"{traceback.format_exc()}\n")
                err_log.flush()
            return f"{cfg['config_id']} {s['sentence_id']}: {type(exc).__name__}: {exc}"
        with lock:
            writer.writerow({"clip_id": cid, "config_id": cfg["config_id"], "sentence_id": s["sentence_id"],
                             "block": s["block"], "kind": s["kind"], "text": s["text"], "vendor": cfg["vendor"],
                             "model": cfg["model"], "voice": cfg["voice"], "first_byte_ms": first, "total_ms": total,
                             "audio_ms": round(len(level) * 1000 / RATE), "gain_db": f"{gain_db:.1f}",
                             "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")})
            out_f.flush()
        return None

    failed = 0
    try:
        with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
            for fut in as_completed([pool.submit(run, t) for t in tasks]):
                error = fut.result()
                if error:
                    failed += 1
                    print(f"  FAIL {error}", file=sys.stderr)
    finally:
        out_f.close()
        err_log.close()
    print(f"done: {len(tasks) - failed} generated, {failed} failed (re-run to retry; details in tts_errors.log)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
