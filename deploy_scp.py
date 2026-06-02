#!/usr/bin/env python3
"""Upload static files to userv via SCP and start server."""
import paramiko
import sys
import os

HOST = '158.46.44.74'
PORT_NUM_SSH = 23
USER = 'userv'
PASS = '1'
REMOTE_DIR = '/home/userv/ad-gen'
LOCAL_DIR = '/home/z/my-project/out'
HTTP_PORT = 8080

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print(f"Connecting to {HOST}:{PORT_NUM_SSH}...")
ssh.connect(HOST, port=PORT_NUM_SSH, username=USER, password=PASS, timeout=30, banner_timeout=30)
print("Connected!")

sftp = ssh.open_sftp()

# Create remote directory
try:
    sftp.stat(REMOTE_DIR)
except FileNotFoundError:
    sftp.mkdir(REMOTE_DIR)

# Clean existing files
print(f"Cleaning {REMOTE_DIR}...")
stdin, stdout, stderr = ssh.exec_command(f"rm -rf {REMOTE_DIR}/*", timeout=10)
stdout.channel.recv_exit_status()

# Upload all files recursively
print(f"Uploading {LOCAL_DIR} -> {REMOTE_DIR}/")
total_size = 0
for root, dirs, files in os.walk(LOCAL_DIR):
    rel_path = os.path.relpath(root, LOCAL_DIR)
    if rel_path == '.':
        remote_path = REMOTE_DIR
    else:
        remote_path = f"{REMOTE_DIR}/{rel_path}"
    
    # Create directories
    for d in dirs:
        try:
            sftp.stat(f"{remote_path}/{d}")
        except FileNotFoundError:
            sftp.mkdir(f"{remote_path}/{d}")
    
    # Upload files
    for f in files:
        local_file = os.path.join(root, f)
        remote_file = f"{remote_path}/{f}"
        file_size = os.path.getsize(local_file)
        total_size += file_size
        sftp.put(local_file, remote_file)
        print(f"  {os.path.relpath(local_file, LOCAL_DIR)} ({file_size} bytes)")

print(f"\nTotal uploaded: {total_size / 1024:.1f} KB")

# Kill any existing server on our port
print(f"\nKilling existing server on port {HTTP_PORT}...")
stdin, stdout, stderr = ssh.exec_command(f"fuser -k {HTTP_PORT}/tcp 2>/dev/null; true", timeout=10)
stdout.channel.recv_exit_status()

# Start HTTP server
print(f"Starting Python HTTP server on port {HTTP_PORT}...")
stdin, stdout, stderr = ssh.exec_command(
    f"cd {REMOTE_DIR} && nohup python3 -m http.server {HTTP_PORT} --bind 0.0.0.0 > /tmp/ad-gen.log 2>&1 &",
    timeout=10
)
stdout.channel.recv_exit_status()

import time
time.sleep(2)

# Verify server is running
stdin, stdout, stderr = ssh.exec_command(
    f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{HTTP_PORT}/",
    timeout=10
)
http_status = stdout.read().decode().strip()
print(f"HTTP status check: {http_status}")

# Show port status
stdin, stdout, stderr = ssh.exec_command(f"ss -tlnp | grep {HTTP_PORT}", timeout=10)
port_out = stdout.read().decode().strip()
print(f"Port status: {port_out}")

# Disk usage
stdin, stdout, stderr = ssh.exec_command(f"du -sh {REMOTE_DIR} && df -h / | tail -1", timeout=10)
print(f"Server status:\n{stdout.read().decode().strip()}")

sftp.close()
ssh.close()

print(f"\n=== Deployment complete! ===")
print(f"URL: http://{HOST}:{HTTP_PORT}")
print(f"Total static files: {total_size / 1024:.1f} KB")
