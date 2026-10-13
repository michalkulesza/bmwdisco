import type { Bytes, Module } from '../types';

export const toHex = (bytes: Bytes) =>
  bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');

export const describeModule = (module: Module) => ({
  sgbd: module.sgbd,
  address: module.address.toString(16).toUpperCase(),
  keepalive: toHex(module.keepalive),
  returnControl: module.returnControl.map(toHex),
  identity: module.identity.map((entry) => `${entry.chassis} ${toHex(entry.response)}`),
  elements: Object.fromEntries(
    Object.entries(module.elements).map(([id, commands]) => [
      id,
      {
        on: toHex(commands.on),
        off: toHex(commands.off),
        response: commands.expectedResponsePrefix ? toHex(commands.expectedResponsePrefix) : null,
      },
    ]),
  ),
  commands: Object.fromEntries(
    Object.entries(module.commands).map(([id, bytes]) => [id, toHex(bytes)]),
  ),
});
