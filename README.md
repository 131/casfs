Casfs, a local content-addressable file system.

// make it work, make is fast, make it clean


[![Build Status](https://travis-ci.org/131/casfs.svg?branch=master)](https://travis-ci.org/131/casfs)
[![Coverage Status](https://coveralls.io/repos/github/131/casfs/badge.svg?branch=master)](https://coveralls.io/github/131/casfs?branch=master)
[![Version](https://img.shields.io/npm/v/casfs.svg)](https://www.npmjs.com/package/casfs)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](http://opensource.org/licenses/MIT)
[![Code style](https://img.shields.io/badge/code%2fstyle-ivs-green.svg)](https://www.npmjs.com/package/eslint-plugin-ivs)

![Available platform](https://img.shields.io/badge/platform-win32-blue.svg)
![Available platform](https://img.shields.io/badge/platform-linux-blue.svg)


# Motivation

[Casfs](https://github.com/131/casfs) in a **file system**, with a very simple design. File metadata (inode table) is stored in a sqlite database ([see dedicated sqlfs project](https://github.com/131/sqlitefs)), and file contents relies on a [content-addressable storage](https://en.wikipedia.org/wiki/Content-addressable_storage). [Casfs](https://github.com/131/casfs) is mainly designed to be a test platform / support backend for **[cloudfs](https://github.com/131/cloudfs)**.



# Roadmap
- [X] Writable Inodes POC (rename, delete, mkdir)
- [X] Initial test flow
- [X] Proper deployment flow
- [X] Writable/editable files
- [X] a bit better test suite (win/linux)
- [X] switch to dedicated project / slice cloudfs
- [X] Readable big files
- [X] Writable big files (continuous mode)

- [ ] Append file/big files  <= *current*
- [ ] Embbed configuration/web browse server
- [ ] Publish read-only mode
- [ ] With full test suite (e.g. winfsp/secfs test suite)

# Background daemon & pending tasks
- [ ] Garbage collection
- [ ] Support for nwjs (fuse-binding & sqlite3)


# Features
* Simple by design
* Unlimited file size (casfs is mostly designed to store and manage 100k files of 8GB+ - aka HD BR rips)
* Available on all platforms (linux & Windows)
* Fast (sqlite is actually fastest than most file system)
* large subset of POSIX including reading/writing files, directories, rename,  symlinks, mode, uid/gid, and extended attributes
* renames do not invole any kind of server side copy
* native file deduplication - through CAS
* Compatible with existing CAS

## Additional features
* nice configuration GUI
* Directroy tree snapshot / rollback / sealing (pure SQL)
* Instant file deletion (pure SQL)
* Server side TAR creation (so content duplication) - through static large object.


# Related
* [cloudfs](https://github.com/131/cloudfs) main application
* [s3ql](https://github.com/s3ql/) python based, non CAS (but fixed block)

# Credits
* [131 - author](https://github.com/131)
