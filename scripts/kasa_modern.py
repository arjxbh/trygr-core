"""JSON-only helper for authenticated Kasa devices and their child outlets."""
import asyncio
import json
import os
import sys

from kasa import Credentials, Discover, SmartDevice
from kasa.exceptions import AuthenticationError


async def main():
    user = os.environ.get("KASA_USERNAME")
    password = os.environ.get("KASA_PASSWORD")
    auth = Credentials(user, password) if user and password else None
    command, *args = sys.argv[1:]
    if command == "scan":
        records = []
        locked = set()
        for broadcast in args:
            devices = await Discover.discover(target=broadcast, credentials=auth, discovery_timeout=3)
            for unit in devices.values():
                try:
                    if not isinstance(unit, SmartDevice):
                        continue
                    await unit.update()
                    for item in [unit, *unit.children]:
                        records.append(dict(id=item.device_id, name=item.alias, ip=unit.host,
                                            type=item.model, status="on" if item.is_on else "off"))
                except AuthenticationError:
                    locked.add(unit.host)
                except Exception:
                    continue
                finally:
                    await unit.disconnect()
        return dict(records=records, locked=len(locked))
    host, device_id, action = args
    unit = await Discover.discover_single(host, credentials=auth)
    if unit is None:
        raise ValueError("Device unavailable")
    try:
        await unit.update()
        item = next(item for item in [unit, *unit.children] if item.device_id == device_id)
        desired = {"turnOn": True, "turnOff": False}[action]
        changed = item.is_on != desired
        if changed:
            await (item.turn_on() if desired else item.turn_off())
        return dict(noOp=not changed)
    finally:
        await unit.disconnect()


if __name__ == "__main__":
    try:
        print(json.dumps(asyncio.run(main())))
    except Exception as exc:
        print(type(exc).__name__, file=sys.stderr)
        sys.exit(1)
