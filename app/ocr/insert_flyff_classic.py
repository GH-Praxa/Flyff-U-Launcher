from pathlib import Path
path = Path('app/src/i18n/translations.ts')
lines = path.read_text(encoding='utf-8').splitlines()
new_lines = []
insert = ["  \"config.theme.flyffClassic\": \"Flyff Classic\",", "  \"config.theme.flyffClassicDesc\": \"Soft rose-gold UI inspired by early Flyff patches.\","]
for idx, line in enumerate(lines):
    new_lines.append(line)
    if 'config.theme.legacyGoldDesc' in line and (idx + 1 >= len(lines) or 'config.theme.flyffClassic' not in lines[idx + 1]):
        new_lines.extend(insert)
path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')
