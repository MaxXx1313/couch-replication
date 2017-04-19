/* jshint esversion: 6 */
var nano = require('./nano-promise');


// http://docs.couchdb.org/en/master/api/server/common.html#replicate
class Replicator {

  constructor(host, prefix){
    this._host = host;
    this._prefix = prefix;

    if(!host){
      throw new Error('Invalid value for: host');
    }
    if(!prefix){
      throw new Error('Invalid value for: prefix');
    }

    this._nano = nano(host);
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


  // copied from nano
  replicate(source, target, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

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


module.exports.Replicator = Replicator;

