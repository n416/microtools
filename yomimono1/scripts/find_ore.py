import glob
import sys

output_file = 'temp_ore.txt'
results = []

for filepath in glob.glob('c:/Users/shingo/Desktop/microtools/yomimono1/public/settings/ep*.mdx'):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if '俺' in line:
            stripped = line.strip()
            # Ignore lines starting with dialogue/thought brackets or markdown/tags
            if stripped.startswith('「') or stripped.startswith('『') or stripped.startswith('（') or stripped.startswith('<') or stripped.startswith('#') or stripped.startswith('-'):
                continue
            # Also ignore blockquotes
            if stripped.startswith('>'):
                continue
            results.append(f"{filepath.split('/')[-1]} Line {i+1}: {stripped}")

with open('c:/Users/shingo/Desktop/microtools/yomimono1/temp_ore.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(results))
