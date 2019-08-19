"use strict";

/**
* Read a local file at random offset,
* with large file (swift style manifest) support
*/

const fs = require('fs');
const {logger} = require('../utils');


class RandomReadFile {

  constructor({block_hash, block_path}) {
    this.manifest = null; // [{hash, bytes, fd : null}, {hash, bytes}]
    this.block_path = block_path;
    this.block_hash = block_hash;
    this.file_size  = -1;
  }

  close() {
    if(this.manifest) {
      for(let part of this.manifest) {
        if(part.fd)
          part.fd = (fs.closeSync(part.fd), null);
      }
    }
  }

  _open() {
    let file_path = this.block_path(this.block_hash);
    //here, add manifest file support
    try {
      let fd   = fs.openSync(file_path, 'r'), stat = fs.fstatSync(fd);
      this.manifest = [{hash : this.block_hash, bytes : stat.size, fd}];
      logger.debug("Opened", file_path);
    } catch(err) {
      if(err.code != 'ENOENT')
        throw err;
      let manifest_path = `${file_path}.manifest`;
      this.manifest = JSON.parse(fs.readFileSync(manifest_path));
      logger.debug("Opened", manifest_path);
    }
    this.file_size = this.manifest.reduce((a, v) => (a += v.bytes, a), 0);
  }


  read(buf, len, offset, cb) {

    if(!this.manifest)
      this._open();

    if(offset >= this.file_size)
      return cb(0);

    let part, start = offset;
    for(part of this.manifest) {
      if(start < part.bytes)
        break;
      start -= part.bytes;
    }

    if(!part.fd) {
      let block_path = this.block_path(part.hash);
      part.fd = fs.openSync(block_path, 'r');
    }

    let remain = len - (part.bytes - start);
    let fixed = remain >= 0 ? Math.min(part.bytes - start, len) : len;

    //console.log("REading", {len, offset, start, part, remain, fixed, file_size : this.file_size});

    fs.read(part.fd, buf, 0, fixed, start, (err, size) => {
      if(remain <= 0)
        return cb(size);

      this.read(buf.slice(fixed), remain, offset + fixed, function(size) {
        cb(fixed + size);
      });
    });
  }

}


module.exports = RandomReadFile;
