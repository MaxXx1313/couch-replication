/* jshint esversion: 6 */
const nano = require('./nano-promise');
const assert = require('assert');


// http://docs.couchdb.org/en/master/api/server/common.html#replicate
class Replicator {

  /**
   * @param {string} host
   * @param {string} prefix
   * @param {string} [newprefix]
   */
  constructor(host, prefix){
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

    let newprefix = opts.newprefix || opts.prefix;
    let after = opts.after;
    delete opts.newprefix;
    delete opts.after;

    // do it
    console.log('  Fetching db list...');
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

          process.stdout.write('  Replicate '+ dbName + ' ...');
          let from = source + '/' + dbName;
          let to = target + '/' + replacePrefix(dbName, self._prefix, newprefix);
          return self._replicateOne( from, to, opts )
            .then(()=>{
              console.log('  Success');
            })
            .catch(e=>{
              console.log('  Error', e.message || e);
            })
            .then(_spawn);
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

