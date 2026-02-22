claudefrom pathlib import Path
path = Path('app/src/i18n/translations.ts')
lines = path.read_text(encoding='utf-8').splitlines()
insert = ['  "config.theme.legacyGold": "Legacy Gold",', '  "config.theme.legacyGoldDesc": "Inspired by the classic brown-and-gold Flyff interface.",']
new_lines = []
for idx, line in enumerate(lines):
    new_lines.append(line)
    if '"config.theme.crimsonEmberDesc"' in line:
        next_line = lines[idx + 1] if idx + 1 < len(lines) else ''
        if 'config.theme.legacyGold' not in next_line:
            new_lines.extend(insert)
path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')
