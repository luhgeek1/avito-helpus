"""Render portal illustrations with Blender.

Usage (from frontend/):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P design/illustrations/render.py -- suitcase laptop

Each name maps to objects/<name>.py, which defines build(rig) and optional CAMERA overrides.
Output: public/portal/illustrations/<name>.webp
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import rig  # noqa: E402

names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not names:
    folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'objects')
    names = sorted(f[:-3].replace('_', '-') for f in os.listdir(folder) if f.endswith('.py') and not f.startswith('_'))

for name in names:
    module = importlib.import_module(f'objects.{name.replace("-", "_")}')
    rig.setup(**getattr(module, 'SETUP', {}))
    rig.VIVID = getattr(module, 'VIVID', False)
    module.build(rig)
    rig.render(name, **getattr(module, 'CAMERA', {}))
    print(f'rendered {name}')
