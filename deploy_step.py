#!/usr/bin/env python3
"""Step-by-step deployment to userv."""
import paramiko
import sys

HOST = '158.46.44.74'
PORT = 23
USER = 'userv'
PASS = '1'
DEPLOY_DIR = '/home/userv/ad-gen'
PORT_NUM = 8080

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=10, banner_timeout=10)

def run(cmd, timeout=30):
    print(f">>> {cmd[:120]}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    for l in out.strip().split('\n')[-15:]:
        print(f"    {l}")
    if rc != 0 and err.strip():
        for l in err.strip().split('\n')[-5:]:
            print(f"    [E] {l}")
    return rc, out

step = sys.argv[1] if len(sys.argv) > 1 else 'all'

if step in ('1', 'all'):
    print("\n=== Step 1: Clone ===")
    run(f"rm -rf {DEPLOY_DIR} && git clone --depth 1 https://github.com/sakurka-cmd/powershell-ad-command-generator.git {DEPLOY_DIR}", timeout=60)

if step in ('2', 'all'):
    print("\n=== Step 2: npm install ===")
    run(f"cd {DEPLOY_DIR} && npm install 2>&1 | tail -5", timeout=120)

if step in ('3', 'all'):
    print("\n=== Step 3: Build ===")
    rc, out = run(f"cd {DEPLOY_DIR} && npx next build 2>&1 | tail -30", timeout=180)
    # Check build result
    rc2, out2 = run(f"ls {DEPLOY_DIR}/out/index.html 2>/dev/null && echo BUILD_OK || echo BUILD_FAIL")
    print(f"BUILD RESULT: {out2.strip()}")

if step in ('4', 'all'):
    print("\n=== Step 4: Cleanup ===")
    run(f"rm -rf {DEPLOY_DIR}/node_modules {DEPLOY_DIR}/.next {DEPLOY_DIR}/src {DEPLOY_DIR}/prisma {DEPLOY_DIR}/skills")
    rc, out = run(f"du -sh {DEPLOY_DIR}/out/")
    print(f"Static site size: {out.strip()}")

if step in ('5', 'all'):
    print("\n=== Step 5: Serve ===")
    run(f"fuser -k {PORT_NUM}/tcp 2>/dev/null; true")
    run(f"cd {DEPLOY_DIR}/out && nohup python3 -m http.server {PORT_NUM} --bind 0.0.0.0 > /tmp/ad-gen.log 2>&1 &")
    import time; time.sleep(2)
    rc, out = run(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{PORT_NUM}/")
    print(f"HTTP status: {out.strip()}")
    run(f"ss -tlnp | grep {PORT_NUM}")

if step in ('6', 'all'):
    print("\n=== Step 6: Status ===")
    run("df -h / | tail -1")
    run("free -m | head -2")

ssh.close()
print("\nDone.")
