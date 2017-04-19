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
    return this._nano.db.list()
      .then(data=>data[0])
      .then(list=>{
        // console.log(list);
        return list.filter(name=>self._isPrefixed(name));
      })
      // no assurance that it's sorted
      .then(list=>list.sort());
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
    let progressTimeout = typeof opts.progress !== "undefined" ? opts.progress : DEFAULT_PROGRESS_TIMEOUT;
    if(progressTimeout < MIN_TIMEOUT){
      progressTimeout = MIN_TIMEOUT;
    }
    delete opts.newprefix;
    delete opts.after;
    delete opts.progress;

    // do it
    this.emit('opStart', 'Fetching db list');
    return this.dbList()
      .then(list=>{
        self.emit('opEnd', 'Done');

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


          self.emit('opStart', 'Replicate '+ dbName );
          let from = source + '/' + dbName;
          let to = target + '/' + replacePrefix(dbName, self._prefix, newprefix);

          if( progressTimeout > 0 ){
            trackProgress(from, to, progress=>{
              self.emit('opProgress', progress);
            });
          }
          return self._replicateOne( from, to, opts )
            .then(()=>{
              stopTrackProgress();
              self.emit('opEnd', 'Success');
            })
            .catch(e=>{
              stopTrackProgress();
              self.emit('opEnd', 'Error' +(e.message || e) );
            })
            .then(_spawn);
        }

        //
        let progressTimer;
        function trackProgress(from, to, callback){
          assert.ok(!progressTimer);
          progressTimer = setInterval(function(){
            self._getProgress(from, to).then(callback);
          }, progressTimeout);
        }
        function stopTrackProgress(){
          if(progressTimer){
            clearInterval(progressTimer);
            progressTimer = null;
          }
        }

        return _spawn();
      });
  }



  // copied from nano
  _replicateOne(source, target, opts) {
    opts = opts || {};
    opts.create_target = true;

    opts.source = this._serializeAsUrl(source);
    opts.target = this._serializeAsUrl(target);

    return this._nano.request({
      db: '_replicate',
      body: opts,
      method: 'POST'
    })
    .then(data=>data[0]);
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


}


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

