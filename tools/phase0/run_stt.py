#!/usr/bin/env python3
"""Stream every recorded take (clean and noisy) to Google Cloud Speech-to-Text
v2 and Azure Speech, both hr-HR, through their STREAMING APIs, and write
transcripts.csv.

    python3 run_stt.py [--manifest clean/manifest.csv ...] [--vendors google azure]

Real-time: audio is sent in --chunk-ms chunks on an absolute clock (chunk k
leaves at t0 + k*chunk), followed by --trailing-silence-ms of digital silence,
also paced. The recognizer therefore has to decide on its own that the speaker
stopped (endpointing); closing the stream is not what finalizes the result.

time_to_final_ms = arrival of the LAST final result minus the moment the take's
own audio finished streaming (before the trailing silence). The take already
ends with ~300 ms of post-roll, so a small negative value means the recognizer
finalized inside the take's own tail. An empty value means no final result.

Google model fallback: streaming hr-HR is tried on --google-model in
--google-location first. If Google rejects that configuration (InvalidArgument /
FailedPrecondition / NotFound: a config error, not a transient one), the take is
retried on --google-fallback-model in --google-fallback-location (default chirp_2
in europe-west4), and every later Google stream in the run uses the fallback
directly. The `model` column records which model produced each transcript
(e.g. google:long@global, google:chirp_2@europe-west4, azure:hr-HR).

Resumable: rows already in transcripts.csv (same file, vendor, condition) are
skipped. A failed stream writes NO row, so re-running retries it; failures are
logged to stt_errors.log.

Credentials (environment):
  Google: GOOGLE_APPLICATION_CREDENTIALS (service-account JSON). The project is
          taken from those credentials, or GOOGLE_CLOUD_PROJECT.
  Azure:  AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import threading
import time
import traceback
import wave
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

RATE = 16000
BYTES_PER_MS = RATE * 2 // 1000  # 16-bit mono
OUT_COLS = ["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"]


@dataclass(frozen=True)
class Task:
    file: str
    vendor: str
    condition: str
    path: Path


def read_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
            raise ValueError(f"{path}: expected 16 kHz mono 16-bit PCM")
        return w.readframes(w.getnframes())


def paced_chunks(speech: bytes, silence_ms: int, chunk_ms: int):
    """Yield (chunk, is_last_speech_chunk) on an absolute real-time schedule."""
    step = chunk_ms * BYTES_PER_MS
    pieces = [speech[i : i + step] for i in range(0, len(speech), step)]
    n_speech = len(pieces)
    pieces += [b"\x00" * step] * max(1, silence_ms // chunk_ms)
    t0 = time.monotonic()
    for k, piece in enumerate(pieces):
        due = t0 + k * chunk_ms / 1000.0
        delay = due - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        yield piece, k == n_speech - 1
    # after the loop the caller half-closes the stream


# ---------------------------------------------------------------------------
# Google Cloud Speech-to-Text v2
# ---------------------------------------------------------------------------

class Google:
    """Speech-to-Text v2 streaming, with a sticky fallback model (see module docstring)."""

    def __init__(self, location: str, model: str, fallback_location: str, fallback_model: str):
        import google.auth

        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            raise SystemExit("GOOGLE_APPLICATION_CREDENTIALS is not set")
        _, project = google.auth.default()
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or project
        if not project:
            raise SystemExit("could not determine the Google Cloud project (set GOOGLE_CLOUD_PROJECT)")
        self.project = project
        self.primary = (location, model)
        self.fallback = (fallback_location, fallback_model)
        self.use_fallback = False
        self._lock = threading.Lock()
        self._clients: dict[str, object] = {}

    def _client(self, location: str):
        from google.api_core.client_options import ClientOptions
        from google.cloud.speech_v2 import SpeechClient

        with self._lock:
            if location not in self._clients:
                opts = None if location == "global" else ClientOptions(api_endpoint=f"{location}-speech.googleapis.com")
                self._clients[location] = SpeechClient(client_options=opts)
            return self._clients[location]

    def transcribe(self, pcm: bytes, chunk_ms: int, silence_ms: int) -> tuple[str, int | None, str]:
        from google.api_core import exceptions as gexc

        if not self.use_fallback:
            try:
                return self._stream(self.primary, pcm, chunk_ms, silence_ms)
            except (gexc.InvalidArgument, gexc.FailedPrecondition, gexc.NotFound) as exc:
                with self._lock:
                    if not self.use_fallback:
                        self.use_fallback = True
                        print(f"  google: {self.primary[1]}@{self.primary[0]} rejected ({type(exc).__name__}: "
                              f"{str(exc)[:160]}); switching to {self.fallback[1]}@{self.fallback[0]}",
                              file=sys.stderr)
        return self._stream(self.fallback, pcm, chunk_ms, silence_ms)

    def _stream(self, target: tuple[str, str], pcm: bytes, chunk_ms: int, silence_ms: int) -> tuple[str, int | None, str]:
        from google.cloud.speech_v2.types import cloud_speech as cs

        location, model = target
        streaming_config = cs.StreamingRecognitionConfig(
            config=cs.RecognitionConfig(
                explicit_decoding_config=cs.ExplicitDecodingConfig(
                    encoding=cs.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=RATE,
                    audio_channel_count=1,
                ),
                language_codes=["hr-HR"],
                model=model,
            ),
            streaming_features=cs.StreamingRecognitionFeatures(interim_results=False),
        )
        recognizer = f"projects/{self.project}/locations/{location}/recognizers/_"
        speech_end: list[float] = []

        def requests():
            yield cs.StreamingRecognizeRequest(recognizer=recognizer, streaming_config=streaming_config)
            for chunk, last_speech in paced_chunks(pcm, silence_ms, chunk_ms):
                yield cs.StreamingRecognizeRequest(audio=chunk)
                if last_speech:
                    speech_end.append(time.monotonic())

        finals: list[str] = []
        last_final: float | None = None
        timeout = len(pcm) / (RATE * 2) + silence_ms / 1000 + 30
        for response in self._client(location).streaming_recognize(requests=requests(), timeout=timeout):
            for result in response.results:
                if result.is_final and result.alternatives:
                    finals.append(result.alternatives[0].transcript)
                    last_final = time.monotonic()
        return join(finals), ttf(last_final, speech_end), f"google:{model}@{location}"


# ---------------------------------------------------------------------------
# Azure Speech
# ---------------------------------------------------------------------------

class Azure:
    def __init__(self):
        import azure.cognitiveservices.speech as speechsdk

        key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
        if not key or not region:
            raise SystemExit("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set")
        self.sdk = speechsdk
        self.key, self.region = key, region

    def transcribe(self, pcm: bytes, chunk_ms: int, silence_ms: int) -> tuple[str, int | None, str]:
        sdk = self.sdk
        config = sdk.SpeechConfig(subscription=self.key, region=self.region, speech_recognition_language="hr-HR")
        stream = sdk.audio.PushAudioInputStream(
            stream_format=sdk.audio.AudioStreamFormat(samples_per_second=RATE, bits_per_sample=16, channels=1)
        )
        recognizer = sdk.SpeechRecognizer(speech_config=config, audio_config=sdk.audio.AudioConfig(stream=stream))

        finals: list[str] = []
        last_final: list[float] = []
        errors: list[str] = []
        done = threading.Event()

        def on_recognized(evt):
            if evt.result.reason == sdk.ResultReason.RecognizedSpeech and evt.result.text:
                finals.append(evt.result.text)
                last_final.append(time.monotonic())

        def on_canceled(evt):
            details = evt.cancellation_details
            if details.reason == sdk.CancellationReason.Error:
                errors.append(f"{details.error_code}: {details.error_details}")
            done.set()

        recognizer.recognized.connect(on_recognized)
        recognizer.canceled.connect(on_canceled)
        recognizer.session_stopped.connect(lambda _evt: done.set())
        recognizer.start_continuous_recognition()
        speech_end: list[float] = []
        try:
            for chunk, last_speech in paced_chunks(pcm, silence_ms, chunk_ms):
                stream.write(chunk)
                if last_speech:
                    speech_end.append(time.monotonic())
        finally:
            stream.close()
        done.wait(timeout=len(pcm) / (RATE * 2) + silence_ms / 1000 + 30)
        recognizer.stop_continuous_recognition()
        if errors:
            raise RuntimeError(f"Azure canceled: {errors[0]}")
        return join(finals), ttf(last_final[-1] if last_final else None, speech_end), "azure:hr-HR"


def join(parts: list[str]) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


def ttf(last_final: float | None, speech_end: list[float]) -> int | None:
    if last_final is None or not speech_end:
        return None
    return round((last_final - speech_end[0]) * 1000)


# ---------------------------------------------------------------------------

def load_manifests(paths: list[Path]) -> list[dict]:
    rows: dict[str, dict] = {}
    for p in paths:
        with open(p, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rows[r["file"]] = r  # a re-recorded take overrides an earlier line
    return [rows[k] for k in sorted(rows)]


def done_keys(out: Path) -> set[tuple[str, str, str]]:
    if not out.exists():
        return set()
    with open(out, newline="", encoding="utf-8") as f:
        return {(r["file"], r["vendor"], r["condition"]) for r in csv.DictReader(f)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, nargs="+", default=[Path("clean/manifest.csv")],
                    help="one or more manifest.csv files (e.g. one per recording machine)")
    ap.add_argument("--clean-dir", type=Path, default=Path("clean"))
    ap.add_argument("--noisy-dir", type=Path, default=Path("noisy"))
    ap.add_argument("--out", type=Path, default=Path("transcripts.csv"))
    ap.add_argument("--vendors", nargs="+", choices=["google", "azure"], default=["google", "azure"])
    ap.add_argument("--conditions", nargs="+", choices=["clean", "noisy"], default=["clean", "noisy"])
    ap.add_argument("--concurrency", type=int, default=4, help="parallel streams (each still paced in real time)")
    ap.add_argument("--chunk-ms", type=int, default=100)
    ap.add_argument("--trailing-silence-ms", type=int, default=1500)
    ap.add_argument("--google-location", default="global")
    ap.add_argument("--google-model", default="long",
                    help="Speech-to-Text v2 model tried first")
    ap.add_argument("--google-fallback-location", default="europe-west4")
    ap.add_argument("--google-fallback-model", default="chirp_2",
                    help="used if the first model rejects streaming hr-HR")
    ap.add_argument("--limit", type=int, default=0, help="only process the first N pending tasks (smoke test)")
    ap.add_argument("--dry-run", action="store_true", help="list pending tasks without calling any service")
    args = ap.parse_args()

    manifest = load_manifests(args.manifest)
    done = done_keys(args.out)
    dirs = {"clean": args.clean_dir, "noisy": args.noisy_dir}
    tasks: list[Task] = []
    missing = 0
    for row in manifest:
        for condition in args.conditions:
            path = dirs[condition] / row["file"]
            for vendor in args.vendors:
                if (row["file"], vendor, condition) in done:
                    continue
                if not path.exists():
                    missing += 1
                    continue
                tasks.append(Task(row["file"], vendor, condition, path))
    if args.limit:
        tasks = tasks[: args.limit]
    print(f"{len(manifest)} takes in manifest; {len(done)} results already done; "
          f"{len(tasks)} to run; {missing} skipped (audio file missing)")
    if args.dry_run or not tasks:
        for t in tasks[:20]:
            print(f"  {t.vendor:6s} {t.condition:5s} {t.file}")
        return 0

    engines = {}
    if "google" in {t.vendor for t in tasks}:
        engines["google"] = Google(args.google_location, args.google_model,
                                   args.google_fallback_location, args.google_fallback_model)
    if "azure" in {t.vendor for t in tasks}:
        engines["azure"] = Azure()

    lock = threading.Lock()
    new_file = not args.out.exists()
    if not new_file:
        with open(args.out, newline="", encoding="utf-8") as f:
            header = next(csv.reader(f), [])
        if header != OUT_COLS:
            raise SystemExit(f"{args.out} has columns {header}, expected {OUT_COLS}; "
                             "it was written by an older run_stt.py: move it aside and re-run")
    out_f = open(args.out, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(out_f, fieldnames=OUT_COLS, lineterminator="\n")
    if new_file:
        writer.writeheader()
        out_f.flush()
    err_log = open("stt_errors.log", "a", encoding="utf-8")

    def run(task: Task) -> tuple[Task, str | None]:
        try:
            transcript, t_final, model = engines[task.vendor].transcribe(
                read_pcm(task.path), args.chunk_ms, args.trailing_silence_ms)
        except Exception as exc:
            with lock:
                err_log.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {task.vendor} {task.condition} "
                              f"{task.file}: {exc}\n{traceback.format_exc()}\n")
                err_log.flush()
            return task, f"{type(exc).__name__}: {exc}"
        with lock:
            writer.writerow({"file": task.file, "vendor": task.vendor, "condition": task.condition,
                             "transcript": transcript, "time_to_final_ms": "" if t_final is None else t_final,
                             "model": model})
            out_f.flush()
        return task, None

    ok = failed = 0
    try:
        with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
            for fut in as_completed([pool.submit(run, t) for t in tasks]):
                task, error = fut.result()
                if error:
                    failed += 1
                    print(f"  FAIL {task.vendor} {task.condition} {task.file}: {error}", file=sys.stderr)
                else:
                    ok += 1
                if (ok + failed) % 25 == 0:
                    print(f"  {ok + failed}/{len(tasks)} ({failed} failed)")
    finally:
        out_f.close()
        err_log.close()
    print(f"done: {ok} written, {failed} failed (re-run to retry; details in stt_errors.log)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
