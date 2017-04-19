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

  dbList(){
    let self = this;

    self.emit('opStart', 'Fetch db list');
    return this._nano.db.list()
      .then(data=>data[0])
      .then(list=>{
        // console.log(list);
        return list.filter(name=>self._isPrefixed(name));
      })
      // no assurance that it's sorted
      .then(list=>list.sort())
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
    if(opts.after){
      assert.ok( this._isPrefixed(opts.after),  'Skip database param is out of scope');
    }

    // get some property and remove it
    let newprefix = opts.newprefix || opts.prefix;
    let after = opts.after;
    delete opts.newprefix;
    delete opts.after;

    // do it
    return this.dbList()
      .then(list=>{
        if(after){
          let index = list.indexOf(after);
          assert.ok(index >= 0, 'Resume database is not found');
          return list.slice(index+1);
        } else {
          return list;
        }
      })
      .then(list=>{
        // by preliminary estimation the recursive mode takes less memory than iterative
        // ...because iterative one allocates memory for the function before any async operation run
        let index = 0;
        function _spawn(){
          let dbName = list[index++];
          if(!dbName){
            return Promise.resolve();
          }

          let from = source + '/' + dbName;
          let to = target + '/' + replacePrefix(dbName, self._prefix, newprefix);
          return self._replicateOne( from, to, opts )
            .catch(e=>{
              console.warn(e.message || e);
            })
            .then(_spawn);
        }

        return _spawn();
      });
  }


  //
  __trackProgress(from, to, progressTimeout, callback){
    assert.ok(!this.progressTimer);
    var self = this;
    this.progressTimer = setInterval(function(){
      self._getProgress(from, to).then(callback);
    }, progressTimeout);
  }
  __stopTrackProgress(){
    if(this.progressTimer){
      clearInterval(this.progressTimer);
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
      self.emit('opEnd', 'Error' +(e.message || e) );
      throw e;
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


  removeAll() {
    let self = this;

    // do it
    return this.dbList()
      .then(list=>{
        // reverse order helps to rollback
        let index = list.length - 1;
        function _spawn(){
          let dbName = list[index--];
          if(!dbName){
            return Promise.resolve();
          }

          self.emit('opStart', 'Remove ' + dbName);
          return self._nano.db.destroy( dbName )
            .then(()=>{
              self.emit('opEnd', 'Removed' );
            })
            .catch(e=>{
              self.emit('opEnd', 'Error' +(e.message || e) );
            })
            .then(_spawn);
        }

        return _spawn();
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

module.exports.Replicator = Replicator;
module.exports.replacePrefix = replacePrefix;

