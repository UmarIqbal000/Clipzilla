import logging
import sys
from pathlib import Path
import click

from clipzilla.config import DEFAULT_WORKDIR, DEFAULT_MODELS_DIR, DEFAULT_CONFIG_PATH, get_llm_provider
from clipzilla.downloader import download_video
from clipzilla.transcriber import transcribe_video
from clipzilla.clipper import cut_clip
from clipzilla.captions import parse_timestamp
from clipzilla.analyzer import run_analysis_for_video
import json

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("clipzilla")


def parse_cli_time(val: str) -> float:
    """Parses a time string which can be a float (e.g. '15' or '15.5') or 'MM:SS' or 'HH:MM:SS'."""
    try:
        return float(val)
    except ValueError:
        return parse_timestamp(val)


def resolve_video_dir(target: str, workdir: Path) -> Path:
    """
    Resolves target into a video directory.
    Target can be:
    - Path to a video directory
    - Video ID (e.g. dQw4w9WgXcQ)
    - None (auto-detect if only 1 video directory exists in workdir)
    """
    workdir = Path(workdir)
    if target:
        path_target = Path(target)
        if path_target.is_dir():
            return path_target
        candidate = workdir / target
        if candidate.is_dir():
            return candidate
        raise click.ClickException(f"Could not find video directory for '{target}' in {workdir}")

    # Auto-detect if target is omitted
    if workdir.exists():
        dirs = [d for d in workdir.iterdir() if d.is_dir()]
        if len(dirs) == 1:
            logger.info(f"Auto-selected only video in workdir: {dirs[0].name}")
            return dirs[0]
        elif len(dirs) > 1:
            raise click.ClickException(
                f"Multiple videos found in {workdir}: {', '.join(d.name for d in dirs)}. "
                "Please specify target video ID or directory."
            )
    raise click.ClickException(f"No downloaded videos found in {workdir}. Run 'clipzilla download <URL>' first.")


@click.group()
@click.version_option()
def main():
    """Clipzilla - monster that devours long-form and spits out shorts."""
    pass


@main.command()
@click.argument("url")
@click.option(
    "--workdir",
    type=click.Path(path_type=Path),
    default=DEFAULT_WORKDIR,
    help="Directory where intermediate video and transcript files are stored.",
)
def download(url: str, workdir: Path):
    """Download a YouTube video capped at 1080p with captions and metadata."""
    click.echo(f"[Clipzilla] Devouring video from: {url}")
    try:
        result = download_video(url=url, workdir=workdir)
        click.secho(
            f"[OK] Successfully downloaded {result['video_id']} to {result['video_dir']}",
            fg="green",
            bold=True,
        )
        if result["caption_files"]:
            click.echo(f"  Captions found: {', '.join(c.name for c in result['caption_files'])}")
        else:
            click.echo("  No subtitles found from YouTube. Whisper will transcribe audio.")
    except Exception as e:
        logger.error(str(e))
        sys.exit(1)


@main.command()
@click.argument("target", required=False)
@click.option(
    "--force-whisper",
    is_flag=True,
    default=False,
    help="Force faster-whisper even if YouTube captions exist.",
)
@click.option(
    "--model",
    default="base",
    help="Whisper model size ('tiny', 'base', 'small', 'medium', 'large-v3'). Default: base.",
)
@click.option(
    "--device",
    default=None,
    help="Device for Whisper ('cpu', 'cuda'). Auto-detected by default.",
)
@click.option(
    "--workdir",
    type=click.Path(path_type=Path),
    default=DEFAULT_WORKDIR,
    help="Directory where intermediate video and transcript files are stored.",
)
def transcribe(target: str, force_whisper: bool, model: str, device: str, workdir: Path):
    """Generate word-level JSON transcript (converting captions or running faster-whisper)."""
    try:
        video_dir = resolve_video_dir(target, workdir)
        click.echo(f"[Clipzilla] Generating word-level transcript for: {video_dir.name}")
        result = transcribe_video(
            video_dir=video_dir,
            force_whisper=force_whisper,
            model_size=model,
            device=device,
        )
        total_segments = len(result.get("segments", []))
        total_words = sum(len(s.get("words", [])) for s in result.get("segments", []))
        source = result.get("source")
        click.secho(
            f"[OK] Transcript generated via '{source}': {total_segments} segments, {total_words} words.",
            fg="green",
            bold=True,
        )
        click.echo(f"  Saved to: {video_dir / 'transcript.json'}")
    except Exception as e:
        logger.error(str(e))
        sys.exit(1)


@main.command()
@click.argument("target", required=False)
@click.option(
    "--start",
    required=True,
    help="Start timestamp in seconds (e.g. 15 or 15.5) or HH:MM:SS.",
)
@click.option(
    "--end",
    required=True,
    help="End timestamp in seconds (e.g. 45 or 45.5) or HH:MM:SS.",
)
@click.option(
    "--output",
    type=click.Path(path_type=Path),
    default=None,
    help="Custom path for output short video.",
)
@click.option(
    "--no-subtitles",
    is_flag=True,
    default=False,
    help="Disable subtitle burning.",
)
@click.option(
    "--workdir",
    type=click.Path(path_type=Path),
    default=DEFAULT_WORKDIR,
    help="Directory where intermediate video and transcript files are stored.",
)
def clip(target: str, start: str, end: str, output: Path, no_subtitles: bool, workdir: Path):
    """Cut a segment into a 1080x1920 vertical short with burned-in animated word subtitles."""
    try:
        video_dir = resolve_video_dir(target, workdir)
        start_sec = parse_cli_time(start)
        end_sec = parse_cli_time(end)

        click.echo(
            f"[Clipzilla] Clipping {video_dir.name} from {start_sec:.2f}s to {end_sec:.2f}s (duration {end_sec - start_sec:.2f}s)..."
        )
        out_path = cut_clip(
            video_dir=video_dir,
            start=start_sec,
            end=end_sec,
            output_path=output,
            burn_subtitles=not no_subtitles,
        )
        click.secho(f"[OK] Short created successfully: {out_path}", fg="green", bold=True)
    except Exception as e:
        logger.error(str(e))
        sys.exit(1)


@main.command()
@click.argument("target", required=False)
@click.option(
    "--provider",
    default=None,
    help="LLM provider override ('ollama_local', 'ollama_cloud', 'openai_compat').",
)
@click.option(
    "--model",
    default=None,
    help="LLM model name override.",
)
@click.option(
    "--config",
    "config_path",
    type=click.Path(path_type=Path),
    default=None,
    help="Path to custom config.yaml.",
)
@click.option(
    "--workdir",
    type=click.Path(path_type=Path),
    default=DEFAULT_WORKDIR,
    help="Directory where intermediate video and transcript files are stored.",
)
def analyze(target: str, provider: str, model: str, config_path: Path, workdir: Path):
    """Analyze transcript with an LLM to identify high-retention short clips."""
    try:
        video_dir = resolve_video_dir(target, workdir)
        click.echo(f"[Clipzilla] Analyzing transcript for: {video_dir.name}")

        llm_provider = get_llm_provider(
            config_path=config_path,
            provider_override=provider,
            model_override=model,
        )

        output_path = run_analysis_for_video(
            video_dir=video_dir,
            provider=llm_provider,
            model=model,
        )

        with open(output_path, "r", encoding="utf-8") as f:
            clips = json.load(f)

        click.secho(f"\n[OK] Identified {len(clips)} suggested clips:", fg="green", bold=True)
        for i, c in enumerate(clips, 1):
            dur = c["end_time"] - c["start_time"]
            trim_flag = "[Needs Trimming]" if c.get("needs_trimming") else "[Clean]"
            click.echo(f"\n  Clip #{i}: {c['title']} ({c['start_time']:.1f}s - {c['end_time']:.1f}s, {dur:.1f}s) {trim_flag}")
            click.echo(f"    Hook/Reason: {c['reason']}")
            if c.get("needs_trimming"):
                click.secho(f"    Heuristic: {c.get('trimming_notes')}", fg="yellow")

        click.secho(f"\nSaved clip suggestions to: {output_path}", fg="cyan")
        click.echo("You can now cut any clip with:")
        if clips:
            c0 = clips[0]
            click.echo(f"  clipzilla clip {video_dir.name} --start {c0['start_time']:.1f} --end {c0['end_time']:.1f}")

    except Exception as e:
        logger.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
