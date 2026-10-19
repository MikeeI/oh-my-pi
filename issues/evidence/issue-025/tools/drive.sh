#!/bin/bash
# usage: drive.sh <tmux-session> <pid> <turns> <outdir>
T=$1; P=$2; N=$3; O=$4
st(){ curl -s 127.0.0.1:18777/stats; }
for i in $(seq 1 $N); do
  before=$(st | python3 -c 'import sys,json;print(json.load(sys.stdin)["reqs"])')
  tmux send-keys -t $T "Bitte Schritt $i ausfuehren" Enter
  for w in $(seq 1 300); do
    timeout 0.2 tail -f /dev/null
    read r d < <(st | python3 -c 'import sys,json;j=json.load(sys.stdin);print(j["reqs"],j["done"])')
    if [ $((r-before)) -ge 2 ] && [ $r -eq $d ]; then timeout 0.6 tail -f /dev/null; read r2 d2 < <(st | python3 -c 'import sys,json;j=json.load(sys.stdin);print(j["reqs"],j["done"])'); [ $r2 -eq $r ] && break; fi
  done
  if [ $((i % 25)) -eq 0 ]; then kill -USR2 $P; timeout 4 tail -f /dev/null; echo "turn=$i rss=$(( $(awk '/VmRSS/{print $2}' /proc/$P/status)/1024 ))MB reqs=$r" >> $O/progress.txt; fi
done
