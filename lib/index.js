"use strict";

const fs = require('fs');

const sprintf = require('util').format;

const fuse      = require('@131/fuse-bindings');
const defer     = require('nyks/promise/defer');
const sleep     = require('nyks/async/sleep');

const timeout  = require('nyks/async/timeout');
const mkdirpSync = require('nyks/fs/mkdirpSync');

//const {S_IFMT, S_IFREG} = fs.constants;//, S_IFDIR, S_IFCHR, S_IFBLK, S_IFIFO, S_IFLNK, S_IFSOCK

const {nodeify, isDirectory, logger, erofs} = require('./utils');
const {O_WRONLY, O_RDWR} = fs.constants; //O_RDONLY,

class casfs {

  constructor(inodes, options) {
    this.fd     = 10;
    this.files  = {};
    this.inodes = inodes;
    this.options = {
      ro : false,
      ...options
    };
  }

  async release(file_path, fd) {
    logger.debug('release', file_path, fd);
    var ent = this.files[fd];
    delete this.files[fd];

    if(!ent)
      return;

    if(ent.reader)
      await ent.reader.close();

    if(ent.writer) { //now update inodes metadata
      let {block_hash, block_size} = await ent.writer.close();
      await this.inodes.update(ent.entry, {
        block_hash,
        file_size : block_size,
        file_mtime : Date.now() / 1000
      });
    }
  }

  block_path(hash) {
    return sprintf("%s/%s/%s", hash.substr(0, 2), hash.substr(2, 1), hash);
  }

  _cas_write(/*entry*/) {
    throw `To be implemented`;
  }

  _cas_read(/*entry*/) {
    throw `To be implemented`;
  }


  async open(file_path, flags) {
    logger.debug('open(%s, %d)', file_path, flags);

    if(flags & O_RDWR) {
      logger.error("O_RDWR disabled for now", file_path, flags);
      return fuse.ENOSYS; //not implemented
    }

    var entry = await this.inodes._get_entry(file_path);

    this.fd++;

    if(flags & O_WRONLY) {
      if(this.options.ro)
        return fuse.EROFS;
      this.files[this.fd] = {entry, writer : this._cas_write(entry)};
    } else {
      this.files[this.fd] = {entry, reader : this._cas_read(entry)};
    }

    return this.fd; // 42 is an fd
  }


  read(path, fd, buf, len, pos, cb) {
    var ent = this.files[fd];
    if(!ent) {
      logger.error("Could not read from", path, fd);
      return cb(fuse.EINVAL);
    }

    ent.reader.read(buf, len, pos, cb);
  }

  write(path, fd, buf, len, pos, cb) {
    var ent = this.files[fd];
    if(!ent) {
      logger.error("Could not write to", path, fd);
      return cb(fuse.EINVAL);
    }

    ent.writer.write(buf, len, pos, cb);
  }

  async create(file_path, mode) {
    if(this.options.ro)
      return fuse.EROFS;

    logger.debug('create(%s, %s)', file_path, mode);
    await this.inodes.create(file_path, mode);
    return this.open(file_path, O_WRONLY);
  }


  async mount(mountPath) {

    if(process.platform != 'win32')
      await mkdirpSync(mountPath);

    this.mountPath = mountPath;
    var next = defer();
    let options =  ['allow_other']; //for smbd

    // for now, winfsp does not support ro (https://github.com/billziss-gh/cgofuse/issues/15)
    // we have to handle this by ourself

    if(this.options.ro)
      options.push('ro');

    fuse.mount(this.mountPath, {
      //force   : true, //not awailable for win32
      options,

      getattr : nodeify(this.inodes.getattr, this.inodes),
      readdir : nodeify(this.inodes.readdir, this.inodes),
      utimens : nodeify(this.inodes.utimens, this.inodes),
      statfs  : nodeify(this.inodes.statfs, this.inodes),

      mkdir   : this.options.ro ? erofs : nodeify(this.inodes.mkdir, this.inodes),
      rmdir   : this.options.ro ? erofs : nodeify(this.inodes.rmdir, this.inodes),
      rename  : this.options.ro ? erofs : nodeify(this.inodes.rename, this.inodes),
      unlink  : this.options.ro ? erofs : nodeify(this.inodes.unlink, this.inodes),
      create  : this.options.ro ? erofs : nodeify(this.create, this),

      open    : nodeify(this.open, this),
      release : nodeify(this.release, this),

      read    : this.read.bind(this),
      write   : this.options.ro ? erofs : this.write.bind(this), //useless to protect, of course.

      truncate : function(path, size, cb) {
        logger.debug("truncate %s to %d", path, size);
        cb();
      },

      ftruncate : function(path, fd, size, cb) {
        logger.debug("ftruncate %s (in %d) to %d", path, fd, size);
        cb();
      },

      access : (path, mode, cb) => {logger.debug('access', arguments); cb(); },
      //fgetattr : (path, fd, cb) => { logger.debug('fgetattr', path, fd); cb(); }, //
      flush  : (path, fd, cb) => { cb(); }, //logger.debug('flush', arguments);

      fsync : (path, fd, datasync, cb) => {logger.debug('fsync', arguments); cb(); },
      fsyncdir : (path, fd, datasync, cb) => {logger.debug('fsyncdir', arguments); cb(); },

      readlink : (path, cb) => {logger.debug('readlink', arguments); cb(); },
      chown : (path, uid, gid, cb) => {logger.debug('chown', arguments); cb(); },
      mknod : (path, mode, dev, cb) => {logger.debug('mknod', arguments); cb(); },

      setxattr : (path, name, buffer, length, offset, flags, cb) => {logger.debug('setxattr', arguments); cb(); },
      getxattr : (path, name, buffer, length, offset, cb) => {logger.debug('getxattr', arguments); cb(); },
      listxattr : (path, buffer, length, cb) => {logger.debug('listxattr', arguments); cb(); },
      removexattr : (path, name, cb) => {logger.debug('removexattr', arguments); cb(); },

      // no need to implement opendir, and it's behave weirldy
      // opendir : (path, flags, cb) => { cb(); }, //logger.debug('opendir', arguments);
      // releasedir : (path, fd, cb) => {cb(); }, //logger.debug('releasedir', arguments);

      link : (src, dest, cb) => {logger.debug('link', arguments); cb(); },
      symlink : (src, dest, cb) => {logger.debug('symlink', arguments); cb(); },
      destroy : (cb) => {logger.debug('destroy', arguments); cb(); },

    }, next.chain);

    logger.info('mounting filesystem at %s in %s mode', this.mountPath, this.options.ro ? "read-only" : "read-write");
    await next;

    process.on('SIGINT', () => {
      this.close();
      setTimeout(() => process.exit(), 2000);
    });

    let stop  = timeout(5 * 1000, `Cannot find mountpoint ${mountPath}`);

    while(!await Promise.race([sleep(200), isDirectory(mountPath), stop]))
      await Promise.race([sleep(200), stop]);

    logger.info('mounted filesystem on', this.mountPath);
  }


  close() {
    logger.info("SHOULD SUTDOWN", this.mountPath);
    if(!this.mountPath)
      return;

    return new Promise((resolve, reject) => {
      fuse.unmount(this.mountPath, (err) => {
        logger.info('filesystem at', this.mountPath, ...(err ? ['not unmounted', err] : ['unmounted']));
        if(err)
          return reject(err);
        resolve();
      });
    });
  }


}


module.exports = casfs;
