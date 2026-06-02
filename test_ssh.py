#!/usr/bin/env python3
"""Quick SSH connection test to userv."""
import paramiko
import sys

HOST = '158.46.44.74'
PORT = 23
USER = 'userv'
PASS = '1'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print(f"Connecting to {HOST}:{PORT} as {USER}...")
try:
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=10, banner_timeout=10, auth_timeout=10)
    print("Connected!")
    
    stdin, stdout, stderr = ssh.exec_command("uname -a && free -m && df -h / && which node git python3 2>/dev/null", timeout=10)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    stdin, stdout, stderr = ssh.exec_command("cat /etc/os-release 2>/dev/null | head -5", timeout=10)
    print(stdout.read().decode())
    
    ssh.close()
    print("Done.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
