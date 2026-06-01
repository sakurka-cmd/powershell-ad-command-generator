#!/usr/bin/env python3
"""Deploy PowerShell AD Command Generator to remote server via SSH."""

import paramiko
import time
import sys

HOST = '158.46.44.74'
PORT = 23
USER = 'userv'
PASS = '1'
REPO_URL = 'https://github.com/sakurka-cmd/powershell-ad-command-generator.git'
DEPLOY_DIR = '/home/userv/powershell-ad-generator'
SERVICE_PORT = 8080

def exec_cmd(ssh, cmd, timeout=60, sudo=False):
    """Execute a command over SSH and return output."""
    if sudo:
        cmd = f"echo '{PASS}' | sudo -S {cmd}"
    print(f"\n[CMD] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(f"[OUT] {out.strip()[:500]}")
    if err.strip() and exit_code != 0:
        print(f"[ERR] {err.strip()[:500]}")
    return out, err, exit_code


def main():
    print(f"=== Connecting to {HOST}:{PORT} as {USER} ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15, banner_timeout=15)
        print("Connected!")
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    try:
        # Check what's available on the server
        print("\n=== Checking server environment ===")
        exec_cmd(ssh, "uname -a")
        exec_cmd(ssh, "which node npm npx python3 2>/dev/null || echo 'checking packages'")
        exec_cmd(ssh, "node --version 2>/dev/null || echo 'no node'")
        exec_cmd(ssh, "python3 --version 2>/dev/null || echo 'no python3'")
        exec_cmd(ssh, "free -m 2>/dev/null || echo 'no free'")
        exec_cmd(ssh, "df -h / 2>/dev/null || echo 'no df'")

        # Check if git is available
        exec_cmd(ssh, "which git 2>/dev/null || echo 'no git'")
        
        # Clone or pull the repo
        print("\n=== Deploying application ===")
        exec_cmd(ssh, f"mkdir -p {DEPLOY_DIR}")
        out, _, _ = exec_cmd(ssh, f"ls {DEPLOY_DIR}/.git 2>/dev/null")
        
        if '.git' in out:
            print("Repo exists, pulling latest...")
            exec_cmd(ssh, f"cd {DEPLOY_DIR} && git pull", timeout=30)
        else:
            print("Cloning repo...")
            exec_cmd(ssh, f"rm -rf {DEPLOY_DIR} && git clone {REPO_URL} {DEPLOY_DIR}", timeout=60)

        # Check for Node.js - if not available, use Python static server
        # First check if we have node
        out, _, node_code = exec_cmd(ssh, "node --version 2>/dev/null")
        has_node = node_code == 0
        
        if has_node:
            print("\n=== Node.js found, building static export ===")
            # Install dependencies and build
            exec_cmd(ssh, f"cd {DEPLOY_DIR} && npm install 2>&1", timeout=120)
            exec_cmd(ssh, f"cd {DEPLOY_DIR} && npx next build 2>&1", timeout=180)
            
            # The static export will be in the 'out' directory
            exec_cmd(ssh, f"ls -la {DEPLOY_DIR}/out/ 2>/dev/null | head -10")
            
            # Kill any existing process on our port
            exec_cmd(ssh, f"fuser -k {SERVICE_PORT}/tcp 2>/dev/null || true")
            
            # Serve with npx serve
            print(f"\n=== Starting static server on port {SERVICE_PORT} ===")
            exec_cmd(ssh, f"cd {DEPLOY_DIR}/out && nohup npx serve -l {SERVICE_PORT} -s > /tmp/ad-generator.log 2>&1 &")
            time.sleep(2)
            exec_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{SERVICE_PORT}/ 2>/dev/null || echo 'failed'")
        else:
            print("\n=== No Node.js, using Python HTTP server with pre-built static files ===")
            # We'll need to build locally and upload, or use a different approach
            # For now, let's try to install node or use an alternative
            
            # Check if we can install node
            out, _, npm_code = exec_cmd(ssh, "which npm 2>/dev/null")
            if npm_code != 0:
                # Try installing node via available package managers
                exec_cmd(ssh, "apt-get update -qq 2>/dev/null || yum check-update -q 2>/dev/null || apk update 2>/dev/null || true", timeout=60)
                exec_cmd(ssh, "apt-get install -y -qq nodejs npm 2>/dev/null || yum install -y nodejs npm 2>/dev/null || apk add nodejs npm 2>/dev/null || true", timeout=120)
                out, _, node_code = exec_cmd(ssh, "node --version 2>/dev/null")
                has_node = node_code == 0

            if not has_node:
                print("Could not install Node.js. Using Python HTTP server approach...")
                # We'll create a simple HTML version that doesn't need build
                exec_cmd(ssh, f"mkdir -p {DEPLOY_DIR}/static")
                exec_cmd(ssh, f"fuser -k {SERVICE_PORT}/tcp 2>/dev/null || true")
                exec_cmd(ssh, f"cd {DEPLOY_DIR}/static && nohup python3 -m http.server {SERVICE_PORT} > /tmp/ad-generator.log 2>&1 &")
                time.sleep(2)
                exec_cmd(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{SERVICE_PORT}/ 2>/dev/null || echo 'failed'")
                print("\nNOTE: Full build requires Node.js. Install Node.js on the server for the complete application.")

        # Show status
        print("\n=== Deployment status ===")
        exec_cmd(ssh, f"ss -tlnp | grep {SERVICE_PORT} || netstat -tlnp | grep {SERVICE_PORT} || echo 'port not listening'")
        exec_cmd(ssh, "cat /tmp/ad-generator.log 2>/dev/null | tail -5")

        print(f"\n=== Done! Application should be available at http://{HOST}:{SERVICE_PORT} ===")

    except Exception as e:
        print(f"Error during deployment: {e}")
    finally:
        ssh.close()
        print("\n=== SSH connection closed ===")


if __name__ == '__main__':
    main()
