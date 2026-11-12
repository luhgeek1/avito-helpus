#!/bin/sh
# Usage: run-all.sh <out-prefix> <route-regex>
cd "$(dirname "$0")"
for vp in desktop laptop tablet phone; do
  VP=$vp node compare.mjs http://127.0.0.1:5180 ${B:-http://127.0.0.1:5173} "$1-$vp.json" "$2" > "$1-$vp.log" 2>&1 &
done
wait
node -e "const fs=require('fs');const out=[];for(const v of ['desktop','laptop','tablet','phone'])out.push(...JSON.parse(fs.readFileSync('$1-'+v+'.json')));fs.writeFileSync('$1.json',JSON.stringify(out))"
node analyze.mjs "$1.json" summary
