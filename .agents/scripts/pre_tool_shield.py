#!/usr/bin/env python3
import sys
import json
import re

BLOCKED_COMMANDS = [
    r"rm\s+-rf\s+[/~]",
    r"rm\s+-rf\s+\*",
    r"git\s+push\s+.*--force.*main",
    r"git\s+push\s+.*-f.*main",
    r"mkfs",
    r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;",  # Fork bomb
]

SECRET_PATTERNS = [
    (r"AIza[0-9A-Za-z\-_]{35}", "Google API Key"),
    (r"sk-ant-[0-9A-Za-z\-_]{30,}", "Anthropic API Key"),
    (r"ghp_[0-9A-Za-z]{36}", "GitHub Personal Access Token"),
    (r"Bearer\s+ya29\.[0-9A-Za-z\-_]+", "Google OAuth Access Token"),
]

def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.stdout.write("{}\n")
            return
        payload = json.loads(raw)
    except Exception:
        sys.stdout.write("{}\n")
        return

    tool_call = payload.get("toolCall", {})
    tool_name = tool_call.get("name", "")
    args = tool_call.get("args", {})

    # 1. Inspect Command Line executions
    if tool_name == "run_command":
        cmd = args.get("CommandLine", "")
        for pattern in BLOCKED_COMMANDS:
            if re.search(pattern, cmd, re.IGNORECASE):
                res = {
                    "decision": "deny",
                    "reason": f"Safety Shield: Dangerous command blocked by policy: '{cmd}'"
                }
                sys.stdout.write(json.dumps(res) + "\n")
                return

    # 2. Inspect File writes for secrets
    if tool_name in ("write_to_file", "replace_file_content"):
        content = args.get("CodeContent", "") or args.get("ReplacementContent", "")
        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, content):
                res = {
                    "decision": "deny",
                    "reason": f"Security Alert: Hardcoded {label} detected in file edit! Never commit raw keys; use .env variables instead."
                }
                sys.stdout.write(json.dumps(res) + "\n")
                return

    # Default: allow
    sys.stdout.write(json.dumps({"decision": "allow"}) + "\n")

if __name__ == "__main__":
    main()
