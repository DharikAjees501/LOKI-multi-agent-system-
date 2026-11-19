import asyncio
import random
from typing import Callable, Any, TypeVar, Awaitable

try:
    from app.core.config import settings
    from app.core.logging import logger
except ImportError:
    from backend.app.core.config import settings
    from backend.app.core.logging import logger

T = TypeVar("T")

async def execute_with_retry(
    func: Callable[[], Awaitable[T]],
    max_retries: int = settings.LLM_MAX_RETRIES,
    backoff_factor: float = settings.LLM_BACKOFF_FACTOR,
    operation_name: str = "LLM API Call"
) -> T:
    """
    Executes an async function with exponential backoff and jitter for resilient API calls.
    """
    attempt = 0
    while attempt < max_retries:
        try:
            attempt += 1
            return await func()
        except Exception as e:
            if attempt >= max_retries:
                logger.error(f"[{operation_name}] Exhausted all {max_retries} retry attempts. Last error: {e}")
                raise e

            # Calculate sleep duration with exponential backoff and jitter
            sleep_duration = (backoff_factor ** attempt) + random.uniform(0.1, 0.5)
            logger.warning(
                f"[{operation_name}] Attempt {attempt}/{max_retries} failed with error: {e}. "
                f"Retrying in {sleep_duration:.2f} seconds..."
            )
            await asyncio.sleep(sleep_duration)

    raise RuntimeError(f"[{operation_name}] Failed unexpectedly after retries.")
