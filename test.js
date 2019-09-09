"use strict";

const path  = require('path');
const Sqlfs = require('sqlitefs');
const Localcasfs = require('./lib/localcasfs');

let mountPath = path.join(__dirname, 'test', 'nowhere');

class tester {

  async run() {
    let fixture_paths = path.join(__dirname, 'test', 'localcas');

    let inodes_path = "./test.sqlite";
    let inodes = new Sqlfs({backend : {type : "local"}, filename : inodes_path});

    await inodes.warmup();

    let server = new Localcasfs(inodes, {root_dir : fixture_paths});
    console.log("All good, mounting file system");
    await server.mount(mountPath);
  }

}

module.exports = tester;
