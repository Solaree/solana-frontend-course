/**
 * Compatibility shim for rpc-websockets v9.
 *
 * rpc-websockets ≥ v9 dropped the dist/lib/client* sub-paths that
 * @solana/web3.js v1.77 and v1.92 import. Those versions do:
 *
 *   var CommonClientModule = require('rpc-websockets/dist/lib/client[.cjs]');
 *   // then later:
 *   class RpcWebSocketClient extends CommonClientModule.default { ... }
 *
 * So the old sub-path exported CommonClient as its *default export*
 * (module.exports = CommonClient). This shim restores that shape.
 */
'use strict';
module.exports = require('rpc-websockets').CommonClient;
