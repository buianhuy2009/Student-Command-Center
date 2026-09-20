#!/usr/bin/env python3
"""
verify_all.py - Self-Auditing Verification Suite for Antigravity CLI Improvements
Tests all suites: statusline, skills, hooks, rules, settings, and shell scripts.
"""

import os
import sys
import json
import subprocess

PASS = "\033[32m[PASS]\033[0m"
FAIL = "\033[31m[FAIL]\033[0m"

errors = 0
checks = 0

def test(name, condition, detail=""):
    global errors, checks
    checks += 1
    if condition:
        print(f" {PASS} {name}")
    else:
        errors += 1
        print(f" {FAIL} {name} - {detail}")

print("\n--- Auditing Antigravity CLI Workspace Enhancements ---\n")

# 1. Status Line Test
statusline_path = os.path.expanduser("~/.gemini/antigravity-cli/statusline.sh")
test("Statusline script exists", os.path.exists(statusline_path))
test("Statusline is executable", os.access(statusline_path, os.X_OK))

# Test statusline execution with mock payload
mock_payload = {
    "model": {"display_name": "Gemini 3.8 Flash"},
    "context_window": {"used_percentage": 10},
    "quota": {
        "gemini-5h": {"remaining_fraction": 0.90, "reset_in_seconds": 3600},
        "gemini-weekly": {"remaining_fraction": 0.85, "reset_in_seconds": 259200}
    }
}
try:
    res = subprocess.run([statusline_path], input=json.dumps(mock_payload), text=True, capture_output=True)
    out = res.stdout.strip()
    test("Statusline runs without error", res.returncode == 0)
    test("Statusline contains 'context' label", "context" in out, out)
    test("Statusline contains 'gemini' label", "gemini" in out, out)
    test("Statusline contains 'weekly' label", "weekly" in out, out)
    test("Statusline has no emojis", not any(ord(c) > 0x1F000 for c in out), "Emoji detected")
except Exception as e:
    test("Statusline runs without error", False, str(e))

# 2. Hooks Test
hooks_path = os.path.expanduser("~/.gemini/config/hooks.json")
test("Global hooks.json exists", os.path.exists(hooks_path))
try:
    with open(hooks_path) as f:
        h_data = json.load(f)
    test("hooks.json contains completion-notifier", "completion-notifier" in h_data)
except Exception as e:
    test("Global hooks.json valid JSON", False, str(e))

# 3. Settings Test
settings_path = os.path.expanduser("~/.gemini/antigravity-cli/settings.json")
test("settings.json exists", os.path.exists(settings_path))
try:
    with open(settings_path) as f:
        s_data = json.load(f)
    test("settings.json has dark theme", s_data.get("colorScheme") == "dark")
    test("settings.json has statusLine command", s_data.get("statusLine", {}).get("type") == "command")
    test("settings.json has stack_with_default true", s_data.get("statusLine", {}).get("stack_with_default") is True)
    test("settings.json has permissions allowlist", len(s_data.get("permissions", {}).get("allow", [])) > 5)
    test("settings.json has permissions denylist", len(s_data.get("permissions", {}).get("deny", [])) >= 3)
except Exception as e:
    test("settings.json valid", False, str(e))

# 4. In-CLI Slash Commands / Skills
skills_dir = "/Users/buianhuy/Downloads/StudentOS/.agents/skills"
test("Skills directory exists", os.path.exists(skills_dir))
expected_skills = [
    "vibe", "audit", "ship", "undo", "savepoint", "clean", "test", "diff",
    "perf", "a11y", "types", "dossier", "explain", "refactor", "security",
    "canvas-sync", "deps", "ui-tokens", "benchmark", "compact"
]
found_skills = [s for s in expected_skills if os.path.exists(os.path.join(skills_dir, s, "SKILL.md"))]
test(f"All 20 In-CLI skills exist ({len(found_skills)}/20)", len(found_skills) == 20, f"Missing: {set(expected_skills) - set(found_skills)}")

# 5. Project Rules
rules_dir = "/Users/buianhuy/Downloads/StudentOS/.agents/rules"
test("Rules directory exists", os.path.exists(rules_dir))
expected_rules = ["no-emojis.md", "surgical-edits.md", "strict-typescript.md", "vite-bundle.md", "security-guards.md"]
found_rules = [r for r in expected_rules if os.path.exists(os.path.join(rules_dir, r))]
test(f"All project rules exist ({len(found_rules)}/5)", len(found_rules) == 5)

# 6. Scripts Test
scripts_dir = "/Users/buianhuy/Downloads/StudentOS/.agents/scripts"
test("Scripts directory exists", os.path.exists(scripts_dir))
test("pre_tool_shield.py is executable", os.access(os.path.join(scripts_dir, "pre_tool_shield.py"), os.X_OK))
test("post_tool_audit.py is executable", os.access(os.path.join(scripts_dir, "post_tool_audit.py"), os.X_OK))
test("savepoint.sh is executable", os.access(os.path.join(scripts_dir, "savepoint.sh"), os.X_OK))
test("revert.sh is executable", os.access(os.path.join(scripts_dir, "revert.sh"), os.X_OK))
test("preflight.sh is executable", os.access(os.path.join(scripts_dir, "preflight.sh"), os.X_OK))

print(f"\nAudit completed: {checks - errors}/{checks} passed.\n")
if errors > 0:
    sys.exit(1)
