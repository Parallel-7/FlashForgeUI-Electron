#!/usr/bin/env python
"""Create a two-tool 3MF fixture whose gcode really changes tools.

Starts from the single-tool AD5X fixture (a real sliced Benchy) and:

- inserts a `T2` tool change at the first line after the byte midpoint of
  Metadata/plate_1.gcode, so tool 0 prints the first half of the file and
  tool 2 prints the second half;
- rewrites Metadata/slice_info.config with two filaments, ids 1 and 3. The
  ids are not consecutive on purpose: the plate uses slicer filaments 1 and 3,
  which print with T0 and T2, so clients must derive the tool from the id and
  not from the list position;
- uses PLA for filament 1 and PETG for filament 3, matching the emulator's
  default station (slot 1 PLA, slot 2 PETG).

It also writes two-tool-toolchange.expected.json with per-tool estimates and
the grams used at 40% and 75% of the gcode bytes. The values are computed
here, independently of the app's own parser, so e2e tests can check the
app's per-tool math against them.
"""
import json
import re
import zipfile

SRC = 'tests/fixtures/print-files/ad5x-single-tool.3mf'
DST = 'tests/fixtures/print-files/two-tool-toolchange.3mf'
EXPECTED = 'tests/fixtures/print-files/two-tool-toolchange.expected.json'

GRAMS_PER_METRE = 2.98  # PLA/PETG at 1.75 mm; only the ratio matters here.
FILAMENTS = [
    {'id': 1, 'tool': 0, 'type': 'PLA', 'color': '#4DA3FF'},
    {'id': 3, 'tool': 2, 'type': 'PETG', 'color': '#FF8A3D'},
]
CHECKPOINTS = [40, 75]

with zipfile.ZipFile(SRC, 'r') as zin:
    entries = {info.filename: zin.read(info.filename) for info in zin.infolist()}

gcode = entries['Metadata/plate_1.gcode']
midpoint = len(gcode) // 2
insert_at = gcode.index(b'\n', midpoint) + 1
gcode = gcode[:insert_at] + b'T2\n' + gcode[insert_at:]
entries['Metadata/plate_1.gcode'] = gcode

# Independent per-tool extrusion sum (relative extrusion, as the file uses M83).
move = re.compile(rb'^G[0-3]\b')
e_param = re.compile(rb'(?:^|\s)E(-?\d*\.?\d+)', re.I)
tool_change = re.compile(rb'^T(\d+)\s*$')
totals = {0: 0.0, 2: 0.0}
checkpoints = {percent: None for percent in CHECKPOINTS}
tool = 0
absolute = False
last_e = 0.0
position = 0
for raw in gcode.split(b'\n'):
    line = raw.split(b';', 1)[0].strip()
    position += len(raw) + 1
    change = tool_change.match(line)
    if change:
        tool = int(change.group(1))
    elif line.startswith(b'M82'):
        absolute = True
    elif line.startswith(b'M83'):
        absolute = False
    elif line.startswith(b'G92'):
        found = e_param.search(line)
        if found:
            last_e = float(found.group(1))
    elif move.match(line):
        found = e_param.search(line)
        if found:
            value = float(found.group(1))
            delta = value - last_e if absolute else value
            if absolute:
                last_e = value
            totals[tool] = max(0.0, totals[tool] + delta)
    for percent in CHECKPOINTS:
        if checkpoints[percent] is None and position >= len(gcode) * percent / 100:
            checkpoints[percent] = dict(totals)

filament_lines = ''
estimates = {}
for filament in FILAMENTS:
    used_m = round(totals[filament['tool']] / 1000, 2)
    used_g = round(used_m * GRAMS_PER_METRE, 2)
    estimates[filament['tool']] = {'usedM': used_m, 'usedG': used_g}
    filament_lines += (
        f'    <filament id="{filament["id"]}" tray_info_idx="GFL99" type="{filament["type"]}" '
        f'color="{filament["color"]}" used_m="{used_m}" used_g="{used_g}" />\n'
    )

slice_info = entries['Metadata/slice_info.config'].decode('utf-8')
slice_info = re.sub(r'    <filament [^\n]*\n', filament_lines, slice_info, count=1)
entries['Metadata/slice_info.config'] = slice_info.encode('utf-8')

plate = json.loads(entries['Metadata/plate_1.json'].decode('utf-8'))
plate['filament_colors'] = [filament['color'] for filament in FILAMENTS]
plate['filament_ids'] = [filament['tool'] for filament in FILAMENTS]
entries['Metadata/plate_1.json'] = json.dumps(plate).encode('utf-8')
entries.pop('Metadata/plate_1.gcode.md5', None)

with zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in entries.items():
        zout.writestr(name, data)

expected = {'tools': {}}
for filament in FILAMENTS:
    tool_id = filament['tool']
    total = totals[tool_id]
    entry = {'filamentId': filament['id'], 'material': filament['type'], **estimates[tool_id]}
    for percent in CHECKPOINTS:
        fraction = checkpoints[percent][tool_id] / total if total > 0 else 0.0
        entry[f'gramsAt{percent}'] = round(estimates[tool_id]['usedG'] * fraction, 3)
    expected['tools'][str(tool_id)] = entry

with open(EXPECTED, 'w', encoding='utf-8') as handle:
    json.dump(expected, handle, indent=2)
    handle.write('\n')

print(f'wrote {DST}')
print(json.dumps(expected, indent=2))
