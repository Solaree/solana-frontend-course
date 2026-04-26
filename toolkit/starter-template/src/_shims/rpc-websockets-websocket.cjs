/**
 * Compatibility shim for rpc-websockets v9.
 *
 * rpc-websockets ≥ v9 dropped the dist/lib/client/websocket* sub-paths that
 * @solana/web3.js v1.77 and v1.92 import. Those versions do:
 *
 *   var WebsocketFactory = require('rpc-websockets/dist/lib/client/websocket[.cjs]');
 *   // then later:
 *   const rpc = WebsocketFactory.default(url, options);
 *
 * So the old sub-path exported the WebSocket factory function as its
 * *default export* (module.exports = WebSocket). This shim restores that.
 */
'use strict';
module.exports = require('rpc-websockets').WebSocket;
