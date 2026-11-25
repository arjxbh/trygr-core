"""Read X10 status and capture the active map. Stdout is the bridge's JSON channel."""
import asyncio
import hashlib
import json
import logging
import os
from pathlib import Path
import sys
import tempfile

import aiohttp
from eufy_omni_cloud.account import EufyAccount
from eufy_omni_cloud.exceptions import EufyAuthError, EufyCloudError, EufyRateLimited
from eufy_omni_cloud.maprender import render_png


def save(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        try:
            temp.write(data)
            temp.flush()
            os.replace(temp.name, path)
        finally:
            Path(temp.name).unlink(missing_ok=True)


def session_file(root, username):
    account_id = hashlib.sha256(username.encode()).hexdigest()
    return root / f"session-{account_id}.json"


async def collect(root, username, password):
    path = session_file(root, username)
    cached = json.loads(path.read_bytes()) if path.exists() else {}
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as http:
        account = EufyAccount(username, password, http, saved_session=cached,
                              openudid=cached.get("openudid"))
        try:
            try:
                await account.async_connect()
            except (EufyAuthError, EufyRateLimited):
                raise
            except (EufyCloudError, OSError, TimeoutError):
                if not account.robots:
                    raise
                # HTTP discovery succeeded even if the map transport is offline.
            robots = [r for r in account.robots.values() if r.model == "T2351"]
            if robots and account.push_connected:
                # The client requests the map after subscribing. Room overlays
                # arrive in later frames than the floor pixels.
                await asyncio.sleep(15)
            rows = []
            for robot in robots:
                key = hashlib.sha256(robot.sn.encode()).hexdigest()
                state = robot.snapshot
                image = root / f"{key}.png"
                if robot.map.has_map:
                    save(image, render_png(robot.map))
                rows.append(dict(key=key, name=robot.name, battery=state.battery,
                                 status="offline" if state.online is False else str(state.activity),
                                 docked=state.docked, mapUpdated=int(image.stat().st_mtime * 1000)
                                 if image.exists() else None, freshMap=robot.map.has_map))
            return dict(status="ok", devices=rows)
        finally:
            try:
                session = account.export_session()
                if session:
                    save(path, json.dumps(session).encode())
            finally:
                await account.async_close()


async def main():
    os.umask(0o077)
    logging.disable(logging.CRITICAL)
    root = Path(sys.argv[1])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Credentials arrive over the child process's private stdin pipe.
    credentials = json.load(sys.stdin)
    try:
        async with asyncio.timeout(80):
            result = await collect(root, credentials["username"], credentials["password"])
    except EufyRateLimited:
        result = dict(status="rate_limited")
    except EufyAuthError:
        result = dict(status="auth_failed")
    except Exception:
        result = dict(status="unavailable")
    print(json.dumps(result))


if __name__ == "__main__":
    asyncio.run(main())
