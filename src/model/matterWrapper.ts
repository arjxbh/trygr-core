import '@project-chip/matter-node.js';
import {
  StorageBackendDisk,
  StorageManager,
} from '@project-chip/matter-node.js/storage';
import { CommissioningController, MatterServer } from '@project-chip/matter.js';
import { ManualPairingCodeCodec } from '@project-chip/matter.js/schema';
import { OnOffCluster } from '@project-chip/matter.js/cluster';
import { NodeId } from '@project-chip/matter.js/datatype';
import { Level, Logger } from '@project-chip/matter.js/log';
import { createServer } from 'node:http';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { device } from '../interfaces';

export class MatterWrapper {
  vendor = 'matter';
  private controller = new CommissioningController({
    adminFabricLabel: 'Trygr',
  });
  private pairing = false;

  private async client(id: string) {
    const match = /^matter:(\d{1,20}):(\d{1,5})$/.exec(id);
    if (!match) throw Error('Invalid endpoint');
    const nodeId = NodeId(BigInt(match[1]));
    if (!this.controller.isNodeCommissioned(nodeId))
      throw Error('Unknown node');
    const node = await this.controller.getNode(nodeId);
    const client = node
      .getDeviceById(Number(match[2]))
      ?.getClusterClient(OnOffCluster);
    if (!node.isConnected || !client) throw Error('Endpoint unavailable');
    return client;
  }

  async performDeviceAction(target: Pick<device, 'id'>, action: string) {
    const client = await this.client(target.id);
    if (action === 'turnOn') await client.on();
    else if (action === 'turnOff') await client.off();
    else throw Error('Unsupported Matter action');
    return { resultText: action, noOp: false };
  }

  async list() {
    const nodes = [];
    for (const id of this.controller.getCommissionedNodes()) {
      const node = await this.controller.getNode(id);
      const endpoints = [];
      const pending = [...(node.getRootEndpoint()?.getChildEndpoints() ?? [])];
      while (pending.length) {
        const endpoint = pending.pop()!;
        pending.push(...endpoint.getChildEndpoints());
        const client = endpoint.getClusterClient(OnOffCluster);
        if (client)
          endpoints.push({
            id: `matter:${id}:${endpoint.number}`,
            name: endpoint.name,
            on: node.isConnected
              ? await client.getOnOffAttribute(true).catch(() => null)
              : null,
          });
      }
      nodes.push({ node: String(id), connected: node.isConnected, endpoints });
    }
    return nodes;
  }

  async start(bindWalkway: (id: string) => void) {
    Logger.level = Level.FATAL;
    const dir = resolve('matter-state');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const storage = new StorageManager(
      new StorageBackendDisk(join(dir, 'fabric')),
    );
    await storage.initialize();
    const server = new MatterServer(storage);
    await server.addCommissioningController(this.controller, {
      uniqueStorageKey: 'trygr',
    });
    await server.start();
    const socket = join(dir, 'admin.sock');
    rmSync(socket, { force: true });
    const admin = createServer(async (req, res) => {
      try {
        if (req.method === 'GET' && req.url === '/discover') {
          const devices = await this.controller.discoverCommissionableDevices(
            {},
            { onIpNetwork: true },
            undefined,
            5,
          );
          res.end(
            `Visible Matter devices advertising for pairing: ${
              devices.filter((d) => d.CM !== 0).length
            }\n`,
          );
          return;
        }
        if (req.method === 'GET' && req.url === '/list') {
          res.end(JSON.stringify(await this.list(), null, 2) + '\n');
          return;
        }
        if (
          req.method !== 'POST' ||
          !['/pair', '/walkway'].includes(req.url ?? '')
        ) {
          res.writeHead(404).end();
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 128) throw Error('Oversized request');
        }
        if (req.url === '/walkway') {
          await this.client(body);
          bindWalkway(body);
          res.end('Walkway endpoint saved.\n');
          return;
        }
        if (this.pairing) {
          res.writeHead(409).end('Pairing in progress.\n');
          return;
        }
        let decoded;
        try {
          decoded = ManualPairingCodeCodec.decode(body);
        } catch {
          res
            .writeHead(400)
            .end('Invalid manual setup code. Check the digits and checksum.\n');
          return;
        }
        const { shortDiscriminator, passcode } = decoded;
        if (shortDiscriminator === undefined)
          throw Error('Missing discriminator');
        this.pairing = true;
        try {
          const matches = (
            await this.controller.discoverCommissionableDevices(
              { shortDiscriminator },
              { onIpNetwork: true },
              undefined,
              8,
            )
          ).filter((d) => d.CM !== 0);
          if (!matches.length) {
            res
              .writeHead(404)
              .end(
                'No device advertising for pairing matched this code on the Mac network interfaces. Reopen the pairing window and retry.\n',
              );
            return;
          }
          if (matches.length > 1) {
            res
              .writeHead(409)
              .end(
                'Multiple devices match. Open the pairing window on only the target device and retry.\n',
              );
            return;
          }
          const id = await this.controller.commissionNode({
            passcode,
            commissioning: {},
            discovery: {
              commissionableDevice: matches[0],
              discoveryCapabilities: { onIpNetwork: true },
            },
          });
          res.end(`Paired node ${id}.\n`);
        } catch (error) {
          // SDK messages may include commissioning data. Only expose the error class.
          const kind =
            error instanceof Error &&
            /^[A-Za-z]+Error$/.test(error.constructor.name)
              ? error.constructor.name
              : 'Error';
          res
            .writeHead(502)
            .end(
              `Matter discovery or commissioning failed (${kind}). Check the pairing window and run matter.sh discover.\n`,
            );
        } finally {
          this.pairing = false;
        }
      } catch {
        res
          .writeHead(400)
          .end(
            'Request failed. Check the endpoint or commissioning window and setup code.\n',
          );
      }
    });
    await new Promise<void>((ok, fail) =>
      admin.once('error', fail).listen(socket, ok),
    );
  }
}
