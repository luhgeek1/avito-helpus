#!/bin/sh
# Reject Microsoft Store aliases: the interpreter must execute real Python 3 code.
set -eu
for candidate in python3 python; do
  if [ "$("$candidate" -c 'import sys; sys.stdout.write("orbi-python3" if sys.version_info.major == 3 else "unsupported")' 2>/dev/null)" = "orbi-python3" ]; then
    exec "$candidate" "$(dirname "$0")/smoke.py" "$@"
  fi
done
echo 'Python 3 is required (python3 or python).' >&2
exit 1
