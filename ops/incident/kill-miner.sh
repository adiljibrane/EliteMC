#!/usr/bin/env bash
# =====================================================================
# EliteMC incident response: find, trace, kill, delete and block the
# cryptominer (/tmp/hasaneyoh -> 157.230.47.83:10005).
#
# Run as root on the elitemc.org server:   sudo bash kill-miner.sh
#
# Evidence is saved in /root/incident-<timestamp>/ BEFORE anything is
# removed. SSH keys are only listed, never deleted (so you can't be
# locked out). Paste the summary printed at the end back to Claude.
# =====================================================================
set -u

POOL_IP="157.230.47.83"
# Indicators of compromise: names/strings that only malware uses
IOC='hasaneyoh|xmrig|xmr-stak|minerd|cpuminer|kdevtmpfsi|kinsing|stratum\+tcp|157\.230\.47\.83|-o [0-9.]+:[0-9]+ -u '
STAMP="$(date +%Y%m%d-%H%M%S)"
EVID="/root/incident-$STAMP"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root: sudo bash $0"; exit 1; fi
mkdir -p "$EVID" && chmod 700 "$EVID"
log() { echo -e "\n=== $* ===" | tee -a "$EVID/summary.txt"; }
say() { echo "$*" | tee -a "$EVID/summary.txt"; }

# ---------------------------------------------------------------------
log "1. BLOCK the mining pool (in and out) so it stops working immediately"
iptables -C OUTPUT -d "$POOL_IP" -j DROP 2>/dev/null || iptables -I OUTPUT -d "$POOL_IP" -j DROP
iptables -C INPUT  -s "$POOL_IP" -j DROP 2>/dev/null || iptables -I INPUT  -s "$POOL_IP" -j DROP
command -v ufw >/dev/null && ufw deny out to "$POOL_IP" >/dev/null 2>&1
say "Blocked $POOL_IP (iptables$(command -v ufw >/dev/null && echo ' + ufw'))"

# ---------------------------------------------------------------------
log "2. FIND miner processes"
# Killed: processes matching the miner's signature, or running a program from /tmp, /var/tmp, /dev/shm.
# NOT killed, only reported: other "(deleted)"/memfd binaries. After a software update, legitimate
# services (nginx, sshd...) also show "(deleted)" until restarted - killing them could take the
# site down or lock you out of SSH.
PIDS=""
SUSPECT=""
for p in /proc/[0-9]*; do
  pid="${p#/proc/}"
  [ "$pid" = "$$" ] && continue
  cmd="$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null)"
  exe="$(readlink "$p/exe" 2>/dev/null)"
  [ -z "$cmd$exe" ] && continue
  case "$cmd" in *kill-miner.sh*) continue;; esac
  if echo "$cmd" | grep -Eq "$IOC" || echo "$exe" | grep -Eq '^/(tmp|var/tmp|dev/shm)/'; then
    PIDS="$PIDS $pid"
  elif echo "$exe" | grep -Eq '\(deleted\)$|^/memfd:'; then
    SUSPECT="$SUSPECT $pid"
  fi
done
if [ -z "$PIDS" ]; then
  say "No miner process running right now."
fi

# ---------------------------------------------------------------------
log "3. TRACE each process: who runs it, since when, what started it, where it connects"
for pid in $PIDS; do
  {
    echo "--- PID $pid"
    ps -o pid,ppid,user,etime,lstart,%cpu,cmd -p "$pid" 2>/dev/null
    echo "binary: $(readlink /proc/$pid/exe 2>/dev/null)"
    echo "working dir: $(readlink /proc/$pid/cwd 2>/dev/null)"
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    echo "started by (parent): $(ps -o pid,user,cmd -p "$ppid" 2>/dev/null | tail -1)"
    echo "connections:"; ss -tunap 2>/dev/null | grep "pid=$pid," || echo "  (none)"
    cp "/proc/$pid/exe" "$EVID/binary-$pid.bin" 2>/dev/null && chmod 000 "$EVID/binary-$pid.bin" \
      && echo "sha256: $(sha256sum "$EVID/binary-$pid.bin" | cut -d' ' -f1)"
  } | tee -a "$EVID/summary.txt"
done

# ---------------------------------------------------------------------
log "4. KILL the miner processes"
for pid in $PIDS; do kill -9 "$pid" 2>/dev/null && say "Killed PID $pid"; done

# ---------------------------------------------------------------------
log "5. DELETE miner files (moved into a locked quarantine folder inside the evidence dir)"
# Programs don't belong in temp folders: any executable program there is removed.
# Quarantined rather than destroyed, so evidence survives and a false positive can be restored.
mkdir -p "$EVID/quarantine" && chmod 700 "$EVID/quarantine"
for d in /tmp /var/tmp /dev/shm; do
  find "$d" -xdev -type f 2>/dev/null | while read -r f; do
    if echo "$f" | grep -Eq "$IOC" || { [ -x "$f" ] && head -c 4 "$f" 2>/dev/null | grep -q 'ELF'; }; then
      say "Removed $f  (sha256 $(sha256sum "$f" | cut -d' ' -f1))"
      mv -f "$f" "$EVID/quarantine/$(echo "$f" | tr '/' '_')" && chmod 000 "$EVID/quarantine/$(echo "$f" | tr '/' '_')"
    fi
  done
done

# ---------------------------------------------------------------------
log "6. REMOVE what restarts it (cron, systemd, startup files, preload)"
save() { [ -e "$1" ] && cp -a "$1" "$EVID/$(echo "$1" | tr '/' '_')" 2>/dev/null; }

# User crontabs
for u in $(cut -d: -f1 /etc/passwd); do
  ct="$(crontab -l -u "$u" 2>/dev/null)" || continue
  if echo "$ct" | grep -Eq "$IOC|/dev/shm/|/tmp/[^ ]+ |curl[^|]*\| *(ba)?sh|wget[^|]*\| *(ba)?sh|base64 -d"; then
    echo "$ct" > "$EVID/crontab-$u.txt"
    echo "$ct" | grep -Ev "$IOC|/dev/shm/|curl[^|]*\| *(ba)?sh|wget[^|]*\| *(ba)?sh|base64 -d" | crontab -u "$u" -
    say "Cleaned crontab of user $u (original saved)"
  fi
done
# System cron files
for f in /etc/crontab /etc/cron.d/* /etc/cron.hourly/* /etc/cron.daily/* /etc/cron.weekly/* /etc/cron.monthly/*; do
  [ -f "$f" ] || continue
  if grep -Eq "$IOC" "$f"; then save "$f"; say "Malicious cron file: $f (saved, removed)"; rm -f "$f"; fi
done
# systemd services
for f in /etc/systemd/system/*.service /lib/systemd/system/*.service /usr/lib/systemd/system/*.service /etc/systemd/system/*/*.service; do
  [ -f "$f" ] || continue
  if grep -Eq "$IOC|/tmp/|/dev/shm/" "$f"; then
    svc="$(basename "$f")"; save "$f"
    systemctl stop "$svc" 2>/dev/null; systemctl disable "$svc" 2>/dev/null; rm -f "$f"
    say "Removed malicious service: $svc"
  fi
done
systemctl daemon-reload 2>/dev/null
# Startup scripts and shell profiles
for f in /etc/rc.local /etc/profile /etc/bash.bashrc /root/.bashrc /root/.profile /home/*/.bashrc /home/*/.profile; do
  [ -f "$f" ] || continue
  if grep -Eq "$IOC" "$f"; then save "$f"; sed -i -E "/$IOC/d" "$f"; say "Cleaned startup file: $f"; fi
done
# Library preload (rootkit technique)
if [ -s /etc/ld.so.preload ]; then
  save /etc/ld.so.preload
  say "WARNING: /etc/ld.so.preload is not empty (possible rootkit) - contents saved, file emptied:"
  cat /etc/ld.so.preload | tee -a "$EVID/summary.txt"; : > /etc/ld.so.preload
fi

# ---------------------------------------------------------------------
log "7. REVIEW (not changed automatically - check these yourself)"
say "--- Processes running a deleted/in-memory program (normal for services after an update; suspicious if unknown or high CPU):"
for pid in $SUSPECT; do ps -o pid=,user=,%cpu=,cmd= -p "$pid" 2>/dev/null | cut -c1-150 | tee -a "$EVID/summary.txt"; done
say "--- SSH keys allowed to log in (any you don't recognise = attacker):"
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -f "$f" ] && { say "$f:"; awk '{print "  " $1 " ... " $NF}' "$f" | tee -a "$EVID/summary.txt"; }
done
say "--- Recent successful logins:"
last -n 15 2>/dev/null | head -15 | tee -a "$EVID/summary.txt"
grep -h "Accepted" /var/log/auth.log* 2>/dev/null | tail -10 | tee -a "$EVID/summary.txt"
say "--- Users with a login shell:"
grep -E ':(/bin/bash|/bin/sh|/bin/zsh)$' /etc/passwd | cut -d: -f1,3 | tee -a "$EVID/summary.txt"
say "--- Other outbound connections (not web/ssh):"
ss -tunp state established 2>/dev/null | grep -Ev ':(22|80|443|53) ' | tail -n +2 | tee -a "$EVID/summary.txt"

# ---------------------------------------------------------------------
log "8. WATCH 60 seconds: does it come back?"
sleep 60
BACK="$(ps -eo pid,user,%cpu,cmd --sort=-%cpu | grep -E "$IOC" | grep -v -E 'grep|kill-miner')"
if [ -n "$BACK" ]; then
  say "!!! MINER CAME BACK - something else restarts it. Send this to Claude:"; say "$BACK"
else
  say "OK: miner did not come back within 60 seconds."
fi
say "Top CPU now:"; ps -eo pid,user,%cpu,cmd --sort=-%cpu | head -6 | tee -a "$EVID/summary.txt"

echo
echo "Evidence and full log: $EVID/summary.txt"
echo "NEXT: paste the output above to Claude. The server is still untrusted:"
echo "      rotate passwords/keys and plan the clean rebuild."
