/**
 * crypt.io - Encryption enabled browser storage
 *
 * https://www.github.com/jas-/crypt.io
 *
 * Author: Jason Gerfen <jason.gerfen@gmail.com>
 * License: MIT (see LICENSE)
 */

'use strict';

let cryptio = (function() {

  const defaults = {
    passphrase: '',
    storage: 'local',
    crypto: {
      length:  256,
      hashing: 'SHA-512',
      keytype: 'AES-GCM',
      output:  'base64'
    }
  };


  class cryptio {

    constrctor(opts) {

      let _storage = new storage(opts),
          _crypto = new crypto(opts),
          _libs = new libs(opts),
          _opts = _libs.merge(defaults, opts);

      _opts.passphrase = _crypto.key(_opts);
    }

    get(key, cb) {
      let ct = this._storage.get(key, cb),
          pt = this._crypto.decrypt(this._opts.passphrase, ct['ct']),
          valid = this._crypto.verify(this._opts.passphrase, ct['signature'],
            pt);

      if (!valid)
        cb('Original signed data has been tampered with!');
        
      cb(null, pt);
    }

    set(key, obj, cb) {
      let ct = {
        signature: this._crypto.signature(this._opts, obj),
        ct: this._crypt.encrypt(this._opts.passphrase, obj)
      }

      cb(null, this._storage.set(key, ct, cb));
    }
  }


  class storage {

    quota(storage) {

      const max = /local|session/.test(storage) ? 1024 * 1025 * 5 : 1024 * 4,
            cur = libs.total(storage),
            total = max - cur;

      return total > 0;
    }

    calculate(storage) {

      let current = '',
          engine = window.storage + 'Storage';

      for (const key in engine) {
        if (engine.hasOwnProperty(key)) {
          current += engine[key];
        }
      }

      return current ? 3 + ((current.length * 16) / (8 * 1024)) : 0;
    }

    getsize(obj) {

      let n = 0;

      if (/object/.test(typeof(obj))) {
        for (const i in obj) {
          if (obj.hasOwnProperty(obj[i])) n++;
        }
      } else if (/array/.test(typeof(obj))) {
        n = obj.length;
      }
      return n;
    }

    set() {

    }

    get() {

    }
  }


  class cookies {

    set() {

    }

    get() {

    }

    domain() {

    }
  }


  class local {

    set(key, obj) {
      try {
        window.localStorage.setItem(key, obj);
        return true;
      } catch (e) {
        return false;
      }
    }

    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return false;
      }
    }
  }


  class session {

    set(key, obj) {
      try {
        window.sessionStorage.setItem(key, obj);
        return true;
      } catch (e) {
        return false;
      }
    }

    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (e) {
        return false;
      }
    }
  }


  class crypto {

    constructor() {
      const _engine = window.crypto || window.msCrypto,
            machine = window.navigator,
            _libs = new libs();
    }

    muid() {
      return this.hash(this.machine.appName + this.machine.language +
        this.machine.appVersion);
    }

    iv() {
      return this._engine.getRandomValues(new Uint8Array(12));
    }

    generate(opts) {

      this._engine.subtle.generateKey({
        name: opts.crypto.keytype,
        length: opts.crypto.length,
      },
      false,
      ["encrypt", "decrypt"]).then(function(key) {
        return this._libs.encodeUTF8(key);
      }).catch(function(err) {
        throw 'Error generating key; ' + err;
      });
    }

    hash(opts, str) {

      this._engine.subtle.digest({
        name: opts.crypto.hashing,
      },
      this.libs.encodeUTF8(str)).then(function(hash) {
        return this._libs.decodeUTF8(hash);
      }).catch(function(err) {
        throw 'Error occurred hashing string; ' + err;
      });
    }
    
    sign(opts, data) {
      this._engine.subtle.sign({
        name: "HMAC",
      },
      opts.crypto.passphrase,
      this._libs.decodeUTF8(data)).then(function(signature) {
        return this._libs.encodeUTF8(signature);
      }).catch(function(err) {
        throw 'Error occurred generating signature; ' + err;
      });
    }
    
    verify(opts, data) {
      this._engine.subtle.verify({
        name: "HMAC",
      },
      opts.passphrase,
      this._libs.decodeUTF8(data)).then(function(isvalid) {
        return isvalid;
      }).catch(function(err) {
        throw 'Error occurred validating signature ' + err;
      });
    }
  }


  class libs {

    merge(defaults, obj) {

      defaults = defaults || {};

      for (const item in defaults) {
        if (defaults.hasOwnProperty(item)) {
          obj[item] = (/object/.test(typeof(defaults[item]))) ?
            this.merge(obj[item], defaults[item]) : defaults[item];
        }
        obj[item] = defaults[item];
      }

      return obj;
    }

    encodeUTF8(str) {

      let i = 0,
          bytes = new Uint8Array(str.length * 4);

      for (const ci = 0; ci != str.length; ci++) {
        let c = str.charCodeAt(ci);

        if (c < 128) {
          bytes[i++] = c;
          continue;
        }

        if (c < 2048) {
          bytes[i++] = c >> 6 | 192;
        } else {
          if (c > 0xd7ff && c < 0xdc00) {

            if (++ci == str.length)
              throw 'UTF-8 encode: incomplete surrogate pair';

            let c2 = str.charCodeAt(ci);

            if (c2 < 0xdc00 || c2 > 0xdfff)
              throw 'UTF-8 encode: second char code 0x' + c2.toString(16) +
                ' at index ' + ci + ' in surrogate pair out of range';

            c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
            bytes[i++] = c >> 18 | 240;
            bytes[i++] = c >> 12 & 63 | 128;
          } else { // c <= 0xffff
            bytes[i++] = c >> 12 | 224;
          }
          bytes[i++] = c >> 6 & 63 | 128;
        }
        bytes[i++] = c & 63 | 128;
      }

      return bytes.subarray(0, i);
    }

    decodeUTF8(bytes) {
      let s = '',
          i = 0;

      while (i < bytes.length) {
        let c = bytes[i++];

        if (c > 127) {
          if (c > 191 && c < 224) {

            if (i >= bytes.length)
              throw 'UTF-8 decode: incomplete 2-byte sequence';

            c = (c & 31) << 6 | bytes[i] & 63;
          } else if (c > 223 && c < 240) {

            if (i + 1 >= bytes.length)
              throw 'UTF-8 decode: incomplete 3-byte sequence';

            c = (c & 15) << 12 | (bytes[i] & 63) << 6 | bytes[++i] & 63;
          } else if (c > 239 && c < 248) {

            if (i + 2 >= bytes.length)
              throw 'UTF-8 decode: incomplete 4-byte sequence';

            c = (c & 7) << 18 | (bytes[i] & 63) << 12 | (bytes[++i] & 63) <<
              6 | bytes[++i] & 63;
          } else {
            throw 'UTF-8 decode: unknown multibyte start 0x' + c.toString(
              16) + ' at index ' + (i - 1);
          }
          ++i;
        }

        if (c <= 0xffff) {
          s += String.fromCharCode(c);

        } else if (c <= 0x10ffff) {
          c -= 0x10000;
          s += String.fromCharCode(c >> 10 | 0xd800)
          s += String.fromCharCode(c & 0x3FF | 0xdc00)
        } else {
          throw 'UTF-8 decode: code point 0x' + c.toString(16) +
            ' exceeds UTF-16 reach';
        }
      }
      return s;
    }
  }

  return cryptio;
})();
