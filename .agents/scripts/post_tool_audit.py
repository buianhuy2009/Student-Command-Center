#!/usr/bin/env python3
import sys
import json
import os
import time

LOG_PATH = os.path.expanduser("/Users/buianhuy/Downloads/StudentOS/.agents/audit.log")

def main():
    try:
        raw = sys.stdin.read()
        if raw.strip():
            payload = json.loads(raw)
            tool_name = payload.get("toolCall", {}).get("name") or "tool"
            err = payload.get("error")
            status = f"FAILED: {err}" if err else "SUCCESS"
            
            os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
            with open(LOG_PATH, "a") as f:
                ts = time.strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"[{ts}] {tool_name} -> {status}\n")
    except Exception:
        pass

    # PostToolUse expects empty JSON
    sys.stdout.write("{}\n")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
