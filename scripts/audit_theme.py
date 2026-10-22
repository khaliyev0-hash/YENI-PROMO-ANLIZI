import os, re

base = r"C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\frontend\src"
results = {}

for root, _, files in os.walk(base):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fp:
                content = fp.read()
            issues = []
            
            # Check for standalone bg-white (not bg-white/20, not focus:bg-white) without dark:bg
            for m in re.finditer(r'className=[\'"][^\'"]*(?<![a-zA-Z0-9:\/])bg-white(?![a-zA-Z0-9\/])(?![^\'"]*dark:bg-)[^\'"]*[\'"]', content):
                issues.append(('bg-white without dark:bg', m.group(0)[:70]))
                
            # Check for standalone bg-gray-50 / bg-slate-50 without dark:bg
            for m in re.finditer(r'className=[\'"][^\'"]*(?<![a-zA-Z0-9:\/])bg-(gray|slate)-50(?![a-zA-Z0-9\/])(?![^\'"]*dark:bg-)[^\'"]*[\'"]', content):
                issues.append(('bg-slate/gray-50 without dark:bg', m.group(0)[:70]))
                
            # Check for standalone border-slate-100/200 without dark:border
            for m in re.finditer(r'className=[\'"][^\'"]*(?<![a-zA-Z0-9:\/])border-(gray|slate)-(?:100|200)(?![a-zA-Z0-9\/])(?![^\'"]*dark:border-)[^\'"]*[\'"]', content):
                issues.append(('border-slate/gray-100/200 without dark:border', m.group(0)[:70]))
                
            # Check for standalone text-slate-800/900 (not hover:text-...) without dark:text
            for m in re.finditer(r'className=[\'"][^\'"]*(?<![a-zA-Z0-9:\/])text-(gray|slate)-(?:800|900)(?![a-zA-Z0-9\/])(?![^\'"]*dark:text-)[^\'"]*[\'"]', content):
                issues.append(('text-slate/gray-800/900 without dark:text', m.group(0)[:70]))

            if issues:
                rel = os.path.relpath(path, base)
                results[rel] = issues

print(f"Total files with issues: {len(results)}")
for k, v in sorted(results.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"{k}: {len(v)} issues")
    for issue_type, sample in v[:3]:
        print(f"   [{issue_type}] {sample}")
