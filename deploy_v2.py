#!/usr/bin/env python3
"""Deploy PowerShell AD Command Generator to userv."""
import paramiko
import time
import sys

HOST = '158.46.44.74'
PORT = 23
USER = 'userv'
PASS = '1'
DEPLOY_DIR = '/home/userv/ad-gen'
SERVICE_PORT = 8080

def run(ssh, cmd, timeout=60):
    """Execute command over SSH."""
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    if out.strip():
        for line in out.strip().split('\n')[-20:]:
            print(f"    {line}")
    if err.strip() and rc != 0:
        for line in err.strip().split('\n')[-10:]:
            print(f"    [E] {line}")
    return rc

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print(f"=== Connecting to {HOST}:{PORT} ===")
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=10, banner_timeout=10)
print("Connected!")

try:
    # Clean up old deployment
    print("\n=== Cleanup ===")
    run(ssh, f"rm -rf {DEPLOY_DIR}")
    run(ssh, f"fuser -k {SERVICE_PORT}/tcp 2>/dev/null; true")

    # Shallow clone to save disk
    print("\n=== Clone repo (shallow) ===")
    run(ssh, f"git clone --depth 1 https://github.com/sakurka-cmd/powershell-ad-command-generator.git {DEPLOY_DIR}", timeout=60)

    # Install dependencies and build static export
    print("\n=== Install dependencies ===")
    run(ssh, f"cd {DEPLOY_DIR} && npm install --omit=dev 2>&1 | tail -5", timeout=120)

    # Need dev deps for build
    print("\n=== Install dev deps for build ===")
    run(ssh, f"cd {DEPLOY_DIR} && npm install 2>&1 | tail -10", timeout=180)

    print("\n=== Build static export ===")
    run(ssh, f"cd {DEPLOY_DIR} && npx next build 2>&1 | tail -20", timeout=180)

    # Check if build succeeded
    rc = run(ssh, f"ls -la {DEPLOY_DIR}/out/index.html 2>/dev/null && echo 'BUILD_OK' || echo 'BUILD_FAIL'")
    
    if 'BUILD_OK' not in str(rc):
        print("Build may have failed, checking output directory...")
        run(ssh, f"ls -la {DEPLOY_DIR}/out/ 2>/dev/null || echo 'no out dir'")
        run(ssh, f"ls -la {DEPLOY_DIR}/.next/ 2>/dev/null | head -5")

    # Clean up node_modules and .next to save space (we only need the static output)
    print("\n=== Clean up build artifacts to save space ===")
    run(ssh, f"rm -rf {DEPLOY_DIR}/node_modules {DEPLOY_DIR}/.next {DEPLOY_DIR}/src {DEPLOY_DIR}/prisma")
    run(ssh, f"du -sh {DEPLOY_DIR}/out/")
    run(ssh, f"df -h /")

    # Serve with Python (lightweight, no Node.js runtime needed)
    print(f"\n=== Start HTTP server on port {SERVICE_PORT} ===")
    run(ssh, f"cd {DEPLOY_DIR}/out && nohup python3 -m http.server {SERVICE_PORT} --bind 0.0.0.0 > /tmp/ad-gen.log 2>&1 &")
    time.sleep(2)
    run(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{SERVICE_PORT}/ 2>/dev/null")

    # Show final status
    print("\n=== Final status ===")
    run(ssh, f"ss -tlnp | grep {SERVICE_PORT}")
    run(ssh, f"cat /tmp/ad-gen.log 2>/dev/null | tail -5")

    print(f"\n=== Deployment complete! ===")
    print(f"URL: http://{HOST}:{SERVICE_PORT}")

except Exception as e:
    print(f"\n!!! Error: {e}")
finally:
    ssh.close()
    print("SSH closed.")
