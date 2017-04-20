/* jshint esversion: 6 */
const nano = require('./nano-promise');
const assert = require('assert');
const EventEmitter = require('events');

const DEFAULT_PROGRESS_TIMEOUT = 2000;
const MIN_TIMEOUT = 1000;

// http://docs.couchdb.org/en/master/api/server/common.html#replicate

/**
 * @emit Replicator#opStart - when long operation is starting
 * @emit Replicator#opProgress - when long operation make progress
 * @emit Replicator#opEnd - when long operation is finished
 * @emit Replicator#opError - when some error/warning occured
 */
class Replicator extends EventEmitter {

  /**
   * @param {string} host
   * @param {string} prefix
   * @param {string} [newprefix]
   */
  constructor(host, prefix){
    super();

    this._host = host;
    this._prefix = prefix;

    assert.ok(this._host, 'Invalid value for: host');
    assert.ok(this._prefix, 'Invalid value for: prefix');
    assert.ok(this._prefix.trim().length>0, 'Invalid value for: prefix');

    this._nano = nano(this._host);
  }

  _isPrefixed(name){
    let m = name.match(/^\w+:\/\/[\w:@\.*]+\/([^/]*)/);
    if(m){
      // got url extract db name
      name = m[1];
    }
    return name.startsWith(this._prefix);
  }

  dbList(host, opts){
    let self = this;
    opts = opts || {};

    let after = opts.after;
    delete opts.after;

    if(after){
      assert.ok( this._isPrefixed(after),  'Skip database param is out of scope');
    }


    self.emit('opStart', 'Fetch db list');
    return (host ? nano(host) : this._nano).db.list()
      .then(data=>data[0])
      .then(list=>{
        // console.log(list);
        return list.filter(name=>self._isPrefixed(name));
      })
      // no assurance that it's sorted
      .then(list=>list.sort())
      .then(list=>{
        if(after){
          let index = list.indexOf(after);
          assert.ok(index >= 0, 'Resume database is not found');
          return list.slice(index+1);
        } else {
          return list;
        }
      })
      .then(result=>{
        self.emit('opEnd', 'Done');
        return result;
      });
  }



  // http://172.16.16.84:5984/_active_tasks
  replicationList(){
    let self = this;

    return this._nano.request({
      db: '_active_tasks',
      // body: {},
      method: 'GET'
    })
    .then(data=>data[0])
    .then(function(data){
      return (data || []).filter(task=>task.type == 'replication');
    })
    .then(list=>{
      // console.log(list);
      return list.filter(repl => self._isPrefixed(repl.source) );
    });
  }


  replicate(source, target, opts) {
    let self = this;
    opts = opts || {};

    // validate input
    if(!opts.newprefix || opts.newprefix == opts.prefix){
      assert.notEqual(source, target,  'Source and target must be different!');
    }

    // get some property and remove it
    let newprefix = opts.newprefix || opts.prefix || self._prefix;
    let withusers = opts.withusers;
    delete opts.newprefix;
    delete opts.withusers;

    // do it
    return this.dbList(source, opts)
      .then(list=>{

        return chainPromise(list, function(dbName){

          let from = source + '/' + dbName;
          let to = target + '/' + replacePrefix(dbName, self._prefix, newprefix);
          return self._replicateOne( from, to, opts )
            .catch(e=>{
              console.warn(e.message || e);
            })
            .then(()=>{
              if(withusers){
                return self._copyUsers( from, to );
              }
            })
            .catch(e=>{
              console.warn(e.message || e);
            });

        });

      });
  }


  //
  __trackProgress(from, to, progressTimeout, callback){
    assert.ok(!this.progressTimer);
    var self = this;
    __setTimer();

    function __setTimer(){
      self.progressTimer = setTimeout(function(){
        self._getProgress(from, to)
          .then(progress=>{
            __setTimer();
            return progress;
          })
          .then(callback);
      }, progressTimeout);
    }
  }

  __stopTrackProgress(){
    if(this.progressTimer){
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
  }



  // copied from nano
  _replicateOne(source, target, opts) {
    var self = this;
    opts = opts || {};

    // get progress parameters
    let progressTimeout = typeof opts.progress !== "undefined" ? opts.progress : DEFAULT_PROGRESS_TIMEOUT;
    if(progressTimeout < MIN_TIMEOUT){
      progressTimeout = MIN_TIMEOUT;
    }
    delete opts.progress;


    opts.source = this._serializeAsUrl(source);
    opts.target = this._serializeAsUrl(target);
    opts.create_target = true;


    if( progressTimeout > 0 ){
      self.__trackProgress(opts.source, opts.target, progressTimeout, progress=>{
        self.emit('opProgress', progress);
      });
    }
    let dbName = (source.match(/[\w_-]+$/) || [])[0] || source;

    self.emit('opStart', 'Replicate ' + dbName );
    return this._nano.request({
      db: '_replicate',
      body: opts,
      method: 'POST'
    })
    .then(data=>data[0])
    .then(()=>{
      self.__stopTrackProgress();
      self.emit('opEnd', 'Success');
    })
    .catch(e=>{
      self.__stopTrackProgress();
      self.emit('opEnd', 'Error: ' +(e.message || e) );
      throw e;
    });
  }


  copyUsers(hostFrom, hostTo, opts){
    var self = this;
    opts = opts || {};

    let newprefix = opts.newprefix || self._prefix;
    delete opts.newprefix;

    // do it
    return this.dbList(hostFrom, opts)
      .then(list=>{
          return chainPromise(list, function(dbName){

            let dbFrom = hostFrom + '/' + dbName;
            let dbTo = hostTo + '/' + replacePrefix(dbName, self._prefix, newprefix);
            return self._copyUsers( dbFrom, dbTo );
          });

      });
  }


  _copyUsers(dbFrom, dbTo){
    var self = this;

    let hostFrom = parseDbUrl(dbFrom).host;
    let hostTo = parseDbUrl(dbTo).host;


    self.emit('opStart', 'Transfer users from ' + parseDbUrl(dbFrom).db );
    return Replicator.getDbUsers(dbFrom)
      .then(userData=>{
        //
        let userList = userData.members && userData.members.names || [];
        let adminList = userData.admins && userData.admins.names || [];
        userList = userList.concat(adminList);

        // copy users profile
        return chainPromise(userList, function(userId){
          self.emit('opProgress', userId);
          return self._copyUser(userId, hostFrom, hostTo)
            .catch(e=>{
              // skip user
              if(e.statusCode != 404){
                throw e;
              } else {
                self.emit('opError', 'User not found: ' + userId);
              }
            });
        })
        .then(()=>{
          // set db security
          // console.log(dbTo);
          return Replicator.setDbUsers(dbTo, userData);
        });
      })
      .then(()=>{
        self.emit('opEnd', 'Done');
      })
      .catch(e=>{
        self.emit('opEnd', 'Error: ' + (e.message || e) );
        throw e;
      });
  }

  _copyUser(userId, from, to){
    return Replicator.getUser(from, userId)
      .then(user=>{
        // console.log(userId, from, to, user);
        delete user._rev;
        return Replicator.setUser(to, user)
          .catch(e=>{
            if(e.statusCode != 409){
              throw e;
            }

            // make sure it's not changed
            return Replicator.getUser(to, userId)
              .then(targetUser=>{
                if( user._rev !== targetUser._rev){
                  user._rev = targetUser._rev;
                  return Replicator.setUser(to, user);
                } else {
                  return {ok: true};
                }
              });
          });

      });

  }

  /**
   * @param {string} source
   * @param {string} target
   * @return {number} percent of replication done for {@Link from}->{@Link to}
   */
  _getProgress(source, target){
    return this.replicationList().then(list=>{
      // console.log(list);
      for (var i = list.length - 1; i >= 0; i--) {
        let item = list[i];

        if(this.__matchUrl(item.source, source) && this.__matchUrl(item.target, target)){
          return item.progress;
        }
      }
      return null;
    });
  }

  // match 'http://admin:*****@172.16.16.84:5984/current-develop_ffa_ext_task/'
  // and   'http://admin:admin@172.16.16.84:5984/current-develop_ffa_ext_task'
  __matchUrl(scrubUrl, url){
    let url1 = this._removeCredentials(scrubUrl).replace(/\/$/, '');
    let url2 = this._removeCredentials(url).replace(/\/$/, '');
    return url1 == url2;
  }

  _removeCredentials(url){
    return url.replace(/^\w+:\/\/(.*?@)[\w-\.:]+\/.*$/, '');
  }



  // copied from nano
  _serializeAsUrl(db) {
    if (typeof db === 'object' && db.config && db.config.url && db.config.db) {
      return urlResolveFix(db.config.url, encodeURIComponent(db.config.db));
    } else {
      return db;
    }
  }


  removeAll(opts) {
    let self = this;

    // do it
    return this.dbList(null, opts)
      .then(list=>{

        // reverse order helps to rollback
        list = list.reverse();
        return chainPromise(list, function(dbName){

          self.emit('opStart', 'Remove ' + dbName);
          return self._nano.db.destroy( dbName )
            .then(()=>{
              self.emit('opEnd', 'Removed' );
            })
            .catch(e=>{
              self.emit('opEnd', 'Error: ' +(e.message || e) );
            });
        });

      });
  }

  off(/*arguments*/){
    return this.removeListener.apply(this, arguments);
  }
}//


function replacePrefix(str, prefix, newprefix){
  if(prefix == newprefix){
    return str;
  }
  if(str.startsWith(prefix)){
    return newprefix + str.substr(prefix.length);
  }
  throw new Error('prefix not match');
}



// http://docs.couchdb.org/en/master/api/database/security.html
function getDbUsers(dbUrl){
  let parsed = parseDbUrl(dbUrl);
  // console.log(parsed);
  return nano(parsed.host).request({
      db: parsed.db,
      doc: '_security',
      // body: {},
      method: 'GET'
    })
    .then(data=>data[0]);
    // { members: { names: [ 'bb85ab47997b55815aa79c093407629f' ], roles: [] } }
}

// http://docs.couchdb.org/en/master/api/database/security.html
function setDbUsers(dbUrl, userData){
  let parsed = parseDbUrl(dbUrl);
  return nano(parsed.host).request({
      db: parsed.db,
      doc: '_security',
      body: userData || {},
      method: 'PUT'
    })
    .then(data=>data[0]);
    // { members: { names: [ 'bb85ab47997b55815aa79c093407629f' ], roles: [] } }
}


function getUser(host, userId){
  let couchUserPrefix = 'org.couchdb.user:';
  if(!userId.startsWith(couchUserPrefix)){
    userId = couchUserPrefix + userId;
  }
  return nano(host).request({
      db: '_users',
      doc: userId,
      // body: {},
      method: 'GET'
    })
    .then(data=>data[0]);
}


function setUser(host, userData){
  return nano(host).request({
      db: '_users',
      doc: userData._id,
      body: userData,
      method: 'PUT'
    })
    .then(data=>data[0]);
}


function parseDbUrl(dbUrl){
  dbUrl = dbUrl.replace(/\/$/, '');
  var pathArray = dbUrl.split('/');
  var db = pathArray.pop();
  var host = pathArray.join('/');
  return {
    host: host,
    db:db
  };
}



/**
 * Run {@link param promiseFn} across each element in array sequentially
 *
 * @param {Array} array
 * @param {function} promiseFn
 * @return {Promise}
 *
 * by preliminary estimation the recursive mode takes less memory than iterative,
 * because iterative one allocates memory for the function before any async operation run
 */
function chainPromise(array, promiseFn){
    var i = 0;
    var result = [];

    function __collectResult(res){
      result.push(res);
    }

    function __step(){
        if(i >= array.length){
          return Promise.resolve();
        }
        let item = array[i++];
        return promiseFn(item)
            .then(__collectResult)
            .then(__step);
    }

    return __step().then(function(){
      return result;
    });
}



module.exports.Replicator = Replicator;
module.exports.replacePrefix = replacePrefix;
module.exports.parseDbUrl = parseDbUrl;


Replicator.getDbUsers = getDbUsers;
Replicator.setDbUsers = setDbUsers;
Replicator.getUser = getUser;
Replicator.setUser = setUser;
