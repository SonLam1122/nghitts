from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from datetime import datetime
from pathlib import Path

from piper import PiperVoice, SynthesisConfig


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPTS_DIR.parent
PORTABLE_MODELS_DIR = SCRIPTS_DIR / "models" / "vi"
REPO_MODELS_DIR = PROJECT_DIR / "public" / "tts-model" / "vi"
DEFAULT_OUTPUT_DIR = PROJECT_DIR / "output"


def resolve_models_dir(models_dir: str | Path | None = None) -> Path:
    candidates = []
    if models_dir:
        candidates.append(Path(models_dir))

    env_models_dir = os.getenv("TTS_MODELS_DIR")
    if env_models_dir:
        candidates.append(Path(env_models_dir))

    candidates.extend([PORTABLE_MODELS_DIR, REPO_MODELS_DIR])

    for candidate in candidates:
        if candidate.exists() and any(candidate.glob("*.onnx")):
            return candidate

    return candidates[0] if candidates else PORTABLE_MODELS_DIR


def list_models(models_dir: Path) -> list[str]:
    return sorted(path.name.removesuffix(".onnx") for path in models_dir.glob("*.onnx"))


def available_voices(models_dir: str | Path | None = None) -> list[str]:
    return list_models(resolve_models_dir(models_dir))


def choose_model(models: list[str]) -> str:
    print("Danh sach giong doc local:")
    for index, model in enumerate(models, start=1):
        print(f"{index:2}. {model}")

    while True:
        raw = input("Chon so thu tu giong doc: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(models):
            return models[int(raw) - 1]
        print("Lua chon khong hop le.")


def get_text(args_text: str | None) -> str:
    if args_text:
        return args_text.strip()

    print("Nhap text can doc. Ket thuc bang Enter:")
    text = input("> ").strip()
    if not text:
        raise SystemExit("Text rong, khong co gi de tao audio.")
    return text


def synthesize_wav(model_path: Path, text: str, wav_path: Path, speed: float) -> None:
    voice = PiperVoice.load(model_path)
    syn_config = SynthesisConfig(length_scale=speed)

    with wave.open(str(wav_path), "wb") as wav_file:
        params_set = False
        for chunk in voice.synthesize(text, syn_config):
            if not params_set:
                wav_file.setframerate(chunk.sample_rate)
                wav_file.setsampwidth(chunk.sample_width)
                wav_file.setnchannels(chunk.sample_channels)
                params_set = True
            wav_file.writeframes(chunk.audio_int16_bytes)


def find_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise SystemExit(
            "Khong tim thay ffmpeg de xuat MP3. Cai bang: python -m pip install imageio-ffmpeg"
        ) from exc


def wav_to_mp3(wav_path: Path, mp3_path: Path, bitrate: str) -> None:
    ffmpeg = find_ffmpeg()
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            bitrate,
            str(mp3_path),
        ],
        check=True,
    )


def safe_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", value).strip(" ._")
    value = re.sub(r"\s+", "_", value)
    return value or "tts"


def text_to_mp3(
    text: str,
    voice: str,
    output_dir: str | Path | None = None,
    filename: str | None = None,
    models_dir: str | Path | None = None,
    speed: float = 1.0,
    bitrate: str = "192k",
) -> Path:
    """Create an MP3 from text using a local Piper voice.

    Put voice files in scripts/models/vi for a portable scripts folder:
    - scripts/models/vi/<voice>.onnx
    - scripts/models/vi/<voice>.onnx.json
    """
    text = text.strip()
    voice = voice.strip()
    if not text:
        raise ValueError("Text is empty.")
    if not voice:
        raise ValueError("Voice is empty.")

    resolved_models_dir = resolve_models_dir(models_dir)
    model_path = resolved_models_dir / f"{voice}.onnx"
    config_path = resolved_models_dir / f"{voice}.onnx.json"
    if not model_path.exists() or not config_path.exists():
        voices = ", ".join(available_voices(resolved_models_dir)) or "none"
        raise FileNotFoundError(
            f"Missing model files for voice '{voice}' in {resolved_models_dir}. "
            f"Available voices: {voices}"
        )

    output_base = Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR
    output_base.mkdir(parents=True, exist_ok=True)
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_filename(voice)}_{timestamp}.mp3"
    if not filename.lower().endswith(".mp3"):
        filename += ".mp3"

    output_path = output_base / filename
    with tempfile.TemporaryDirectory() as temp_dir:
        wav_path = Path(temp_dir) / "tts.wav"
        synthesize_wav(model_path, text, wav_path, speed)
        wav_to_mp3(wav_path, output_path, bitrate)

    return output_path.resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tao file MP3 tu model Piper local.")
    parser.add_argument("--text", help="Text can chuyen thanh giong doc.")
    parser.add_argument("--voice", help="Ten voice, vi du: 'Duy Oryx'. Bo trong de chon bang menu.")
    parser.add_argument("--output", help="File MP3 dau ra. Mac dinh tao trong folder output.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Thu muc output mac dinh.")
    parser.add_argument("--models-dir", help="Thu muc chua file .onnx. Mac dinh: scripts/models/vi.")
    parser.add_argument("--speed", type=float, default=1.0, help="Toc do doc: <1 nhanh hon, >1 cham hon.")
    parser.add_argument("--bitrate", default="192k", help="MP3 bitrate, vi du 128k/192k/256k.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    models_dir = resolve_models_dir(args.models_dir)
    models = list_models(models_dir)
    if not models:
        raise SystemExit(f"Khong tim thay model .onnx trong {models_dir}")

    model_name = args.voice.strip() if args.voice else choose_model(models)
    text = get_text(args.text)
    output_arg = Path(args.output) if args.output else None
    output_dir = output_arg.parent if output_arg else Path(args.output_dir)
    filename = output_arg.name if output_arg else None

    print(f"Dang tao audio voi voice: {model_name}")
    output_path = text_to_mp3(
        text=text,
        voice=model_name,
        output_dir=output_dir,
        filename=filename,
        models_dir=models_dir,
        speed=args.speed,
        bitrate=args.bitrate,
    )
    print(f"Da tao MP3: {output_path.resolve()}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nDa huy.")
