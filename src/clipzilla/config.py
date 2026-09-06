from pathlib import Path
import ctranslate2

# Default directory paths
DEFAULT_WORKDIR = Path("workdir")
DEFAULT_MODELS_DIR = Path("models")

# Video short dimensions (vertical 9:16)
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920


def is_cuda_functional() -> bool:
    """Checks if CUDA is both detected and has functional runtime libraries."""
    try:
        if ctranslate2.get_cuda_device_count() > 0:
            # Check if CTranslate2 can actually run on CUDA without missing cublas/cudnn DLLs
            # Smallest dummy test
            ctranslate2.StorageView.from_array([1.0]).to("cuda")
            return True
    except Exception:
        return False
    return False


def get_default_device() -> str:
    """
    Returns 'cuda' if a functional CUDA GPU is present, else 'cpu'.
    Defaults to CPU if GPU or CUDA DLLs are missing.
    """
    if is_cuda_functional():
        return "cuda"
    return "cpu"


def get_default_compute_type(device: str) -> str:
    """Returns 'int8' for CPU / GPU, with graceful compatibility."""
    return "int8"
