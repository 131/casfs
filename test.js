"use strict";

const fs = require('fs');
const path  = require('path');

const guid   = require('mout/random/guid');
const drain  = require('nyks/stream/drain');

const Sqlfs = require('sqlitefs');
const Localcasfs = require('./lib/localcasfs');

let mountPath = path.join(__dirname, 'test', 'nowhere');

class tester {

  async run() {
    let fixture_paths = path.join(__dirname, 'test', 'localcas');
    let mock_path = path.join(fixture_paths, 'index.json');
    let mock = fs.existsSync(mock_path) ? require(mock_path) : [];

    let inodes_path = "./test.sqlite";
    let inodes = new Sqlfs(inodes_path);

    if(await inodes.warmup())
      await inodes.load(mock);

    let server = new Localcasfs(inodes, {root_dir : fixture_paths});
    console.log("All good, mounting file system");
    await server.mount(mountPath);
  }

  async stress() {
    let random = guid(), payload = "this is contents";
    let subpath = "/somefile";
    let somepath = path.join(mountPath, subpath);
    let dst = fs.createWriteStream(somepath);
    dst.write(random), dst.end(payload);

    await new Promise(resolve => dst.on('finish', resolve));

    console.log("Got finish event, now checking");
    let body = fs.createReadStream(somepath);
    body = String(await drain(body));
    console.log("Got body", body, "compare to", random + payload);
  }

}

module.exports = tester;
