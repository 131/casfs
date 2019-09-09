"use strict";

/**
* Write a local file sequentialy (at non random offset)
* with large file (swift style manifest) support
*/
const fs     = require('fs');
const crypto = require('crypto');
const path   = require('path');

const mkdirpSync = require('nyks/fs/mkdirpSync');
const {fuse, logger} = require('../utils');


const BIGFILE_SPLIT = (1 << 30) * 5; //5Go
//const BIGFILE_SPLIT = (1 << 20) * 5; //5Mo


class SeqWriteFile {
  constructor({block_path, block_tmp, block_size_limit}) {

    this.block_size_limit = block_size_limit || BIGFILE_SPLIT;
    this.block_path       = block_path;
    this.block_tmp        = block_tmp;

    this.parts = [];
  }

  async close() {
    if(!this.part_fd)
      return;

    this._close_part();

    let block_hash = this.block_hash.digest("hex");
    let block_path = this.block_path(block_hash);
    let block_size = this.parts.reduce((acc, part) => (acc += part.part_size, acc), 0);

    logger.debug("Got content hash", block_hash, block_path, this.parts, block_size);

    if(this.parts.length > 1)
      await this._register_manifest(block_hash);

    return {block_hash, block_size};
  }

  _register_manifest(block_hash) {
    let manifest = [];
    for(let {part_hash : hash, part_size : bytes} of this.parts)
      manifest.push({hash, bytes});

    let manifest_path = `${this.block_path(block_hash)}.manifest`;
    mkdirpSync(path.dirname(manifest_path));
    fs.writeFileSync(manifest_path, JSON.stringify(manifest, null, 2));
    //console.log("Wrote manifest", manifest_path, JSON.stringify(manifest, null, 2));
  }

  async _open() {
    this.block_offset = 0;
    this.block_hash   = crypto.createHash('md5');
    this._new_part();
  }

  _close_part() {
    fs.closeSync(this.part_fd);

    let part_hash = this.part_hash.digest("hex");
    let part_path = this.block_path(part_hash);
    //console.log("Got part hash", part_hash, part_path);
    mkdirpSync(path.dirname(part_path));
    fs.renameSync(this.part_path, part_path);
    this.part_fd = null;
    this.parts.push({part_hash, part_size : this.part_offset});
  }

  _new_part() {
    this.part_hash    = crypto.createHash('md5');
    this.part_path    = this.block_tmp();
    this.part_fd      = fs.openSync(this.part_path, "w");
    this.part_offset  = 0;
  }

  _rotate_part() {
    this._close_part();
    this._new_part();
  }

  write(buf, len, offset, cb) {

    if(!this.part_fd) {
      this._open().then(() => {
        this.write(buf, len, offset, cb);
      });
      return;
    }

    if(this.block_offset !== offset)
      return cb(fuse.ESPIPE); //invalid offset
    //  block_offet 40, len 31, size_limit 64
    // remain 7
    // fixed 24

    let remain = len - (this.block_size_limit - this.part_offset);
    let fixed = remain >= 0 ? this.block_size_limit - this.part_offset : len;

    //console.log("Writing", {len, offset, fixed, remain});

    fs.write(this.part_fd, buf, 0, fixed, this.part_offset, (err, size) => {

      this.block_hash.update(buf.slice(0, fixed));
      this.part_hash.update(buf.slice(0, fixed));

      this.part_offset  += fixed;
      this.block_offset += fixed;

      if(remain <= 0)
        return cb(size); //fixed

      this._rotate_part();

      this.write(buf.slice(fixed), remain, this.block_offset, (size1) => {
        //console.log("DONE WRITING", fixed + size1);
        cb(fixed + size1);
      });
    });
  }

}

module.exports = SeqWriteFile;
