#!/usr/bin/env python3
"""Reliable recursive SCP upload + start server."""
import paramiko
import os
import sys
import time

HOST = '158.46.44.74'
SSH_PORT = 23
USER = 'userv'
PASS = '1'
REMOTE_DIR = '/home/userv/ad-gen'
LOCAL_DIR = '/home/z/my-project/out'
HTTP_PORT = 8080

def mkdir_p(sftp, path):
    """Recursively create remote directory."""
    parts = path.split('/')
    current = ''
    for part in parts:
        if not part:
            current = '/' if not current else current + '/'
            continue
        current = f"{current}/{part}" if current != '/' else f"/{part}"
        try:
            sftp.stat(current)
        except FileNotFoundError:
            try:
                sftp.mkdir(current)
            except Exception:
                pass

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting...")
ssh.connect(HOST, port=SSH_PORT, username=USER, password=PASS, timeout=30, banner_timeout=30)
print("Connected!")

# Clean and recreate
print("Cleaning remote dir...")
stdin, stdout, stderr = ssh.exec_command(f'rm -rf {REMOTE_DIR} && mkdir -p {REMOTE_DIR}', timeout=15)
stdout.channel.recv_exit_status()

sftp = ssh.open_sftp()

# Walk and upload
print(f"Uploading {LOCAL_DIR}...")
file_count = 0
total_bytes = 0

for root, dirs, files in os.walk(LOCAL_DIR):
    rel = os.path.relpath(root, LOCAL_DIR)
    remote_base = REMOTE_DIR if rel == '.' else f"{REMOTE_DIR}/{rel.replace(os.sep, '/')}"
    
    for d in dirs:
        mkdir_p(sftp, f"{remote_base}/{d}")
    
    for fname in files:
        local_path = os.path.join(root, fname)
        remote_path = f"{remote_base}/{fname}"
        try:
            sz = os.path.getsize(local_path)
            sftp.put(local_path, remote_path)
            total_bytes += sz
            file_count += 1
            print(f"  [{file_count}] {os.path.relpath(local_path, LOCAL_DIR)} ({sz:,} b)")
        except Exception as e:
            print(f"  FAIL: {fname}: {e}")

print(f"\nUploaded {file_count} files, {total_bytes/1024:.0f} KB total")

sftp.close()

# Verify upload
print("\nVerifying...")
stdin, stdout, stderr = ssh.exec_command(f'find {REMOTE_DIR} -type f | wc -l', timeout=10)
local_count = sum(len(f) for _, _, f in os.walk(LOCAL_DIR))
remote_count = int(stdout.read().decode().strip())
print(f"Local files: {local_count}, Remote files: {remote_count}")
if local_count != remote_count:
    print("WARNING: File count mismatch!")

# Kill old server and start new one
print(f"\nStarting server on port {HTTP_PORT}...")
stdin, stdout, stderr = ssh.exec_command(f"fuser -k {HTTP_PORT}/tcp 2>/dev/null; sleep 1; cd {REMOTE_DIR} && nohup python3 -m http.server {HTTP_PORT} --bind 0.0.0.0 > /tmp/ad-gen.log 2>&1 &", timeout=10)
stdout.channel.recv_exit_status()

time.sleep(3)

# Verify
stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{HTTP_PORT}/", timeout=10)
status = stdout.read().decode().strip()
print(f"HTTP status: {status}")

stdin, stdout, stderr = ssh.exec_command(f"ss -tlnp | grep {HTTP_PORT}", timeout=10)
print(f"Port: {stdout.read().decode().strip()}")

stdin, stdout, stderr = ssh.exec_command(f"cat /tmp/ad-gen.log 2>/dev/null | tail -5", timeout=10)
log = stdout.read().decode().strip()
if log:
    print(f"Log: {log}")

ssh.close()
print(f"\n=== DEPLOYED: http://{HOST}:{HTTP_PORT} ===")
