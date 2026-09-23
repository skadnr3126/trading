"""A tiny JSON-in / JSON-out Python backend for the Tauri study example.

Do not print logs to stdout: Rust expects stdout to contain only the response JSON.
Use stderr for diagnostic messages instead.
"""

import json
import sys
from typing import Any


def handle(request: dict[str, Any]) -> dict[str, Any]:
    action = request.get("action")

    if action == "ping":
        return {
            "ok": True,
            "message": "Hello from Python. Rust started this process and sent me JSON.",
            "result": None,
            "error": None,
        }

    if action == "add":
        left = request.get("left")
        right = request.get("right")

        if not isinstance(left, int) or not isinstance(right, int):
            return {
                "ok": False,
                "message": None,
                "result": None,
                "error": "'left' and 'right' must be integers.",
            }

        return {
            "ok": True,
            "message": f"Python calculated {left} + {right}.",
            "result": left + right,
            "error": None,
        }

    return {
        "ok": False,
        "message": None,
        "result": None,
        "error": f"Unknown action: {action!r}",
    }


def main() -> None:
    try:
        request = json.load(sys.stdin)
        response = handle(request)
        print(json.dumps(response))
    except Exception as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "message": None,
                    "result": None,
                    "error": str(error),
                }
            )
        )


if __name__ == "__main__":
    main()
