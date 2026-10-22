import os, re

base = r"C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\frontend\src"
hook_regex = re.compile(r'\b(use[A-Z]\w*)\s*\(')
early_return_regex = re.compile(r'^\s*if\s*\([^)]+\)\s*return\b')

violations = []

for root, _, files in os.walk(base):
    for f in files:
        if f.endswith('.tsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fp:
                lines = fp.readlines()
            
            in_component = False
            seen_early_return = False
            early_return_line = -1
            
            for idx, line in enumerate(lines, 1):
                # Detect start of functional component or component body
                if re.search(r'export const \w+:\s*React\.FC', line) or re.search(r'function \w+\s*\(', line):
                    seen_early_return = False
                    early_return_line = -1
                    
                # Detect early returns like: if (!data) return null; or if (loading) return ...
                if re.search(r'^\s*if\s*\([^)]+\)\s*return\b', line) and not 'return () =>' in line:
                    # check if it's an early return at component level (indentation ~4-6 spaces)
                    indent = len(line) - len(line.lstrip())
                    if indent in (4, 6):
                        seen_early_return = True
                        early_return_line = idx
                
                # Check if a hook is used after seen_early_return
                hook_match = hook_regex.search(line)
                if hook_match and seen_early_return:
                    # make sure it's not a custom helper function inside component
                    indent = len(line) - len(line.lstrip())
                    if indent in (2, 4, 6):
                        rel = os.path.relpath(path, base)
                        violations.append((rel, idx, hook_match.group(1), early_return_line))

if violations:
    print(f"FAILED: Found {len(violations)} Hook Rule violations (hook called after early return):")
    for file, line, hook, ret_line in violations:
        print(f"  {file}:{line} -> '{hook}' called AFTER early return at line {ret_line}")
    exit(1)
else:
    print("PASSED: 0 Hook Rule violations found across all frontend components!")
