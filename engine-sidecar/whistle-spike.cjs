const path = require('node:path');
const start = require('../.runtime/whistle/node_modules/whistle');
start({host:'127.0.0.1',port:Number(process.argv[2]),baseDir:path.resolve(process.argv[3]),mode:'disableUpdateTips|disableCheckUpdate',rules:'*/rewrite resHeaders://x-fixture=rewritten'},()=>console.log('READY'));
