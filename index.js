#!/bin/env node
/* jshint esversion: 6 */
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const prettyFormat      = require('./lib/cli-tools.js').prettyFormat;
const prettyFormatArray = require('./lib/cli-tools.js').prettyFormatArray;
const Replicator = require('./lib/replicator.js').Replicator;

const singleLog = require('single-line-log').stdout;

const LopConsole = require('./lib/LopConsole');
const logger = new LopConsole();

const HOST_DEFAULT = 'http://localhost:5984';

const optionDefinitions = [
  { name: 'operation', type: String, defaultOption:true,
    description: 'main operation. See below for details'
  },
  { name: 'help',    alias: "h", type: Boolean, description: "print this help" },
  { name: 'prefix',  alias: 'p', type: String,  description: 'db prefix' },
  { name: 'src',     alias: 's', type: String,  description: 'replication source url' },
  { name: 'target',  alias: 't', type: String,  description: 'replication target url' },
  { name: 'replicator',  alias: 'r', type: String, description: 'replicator host url. default=source'},
  { name: 'newprefix',  type: String,  description: '(optional) set new prefix for dbs while replicating'},
  { name: 'after',      type: String,  description: '(optional) resume replication since that db name'},
  { name: 'withusers',  type: Boolean, description: '(optional) replicate and copy user credentials'},
  { name: 'db',  alias: 'd', type: String,  description: 'specify database (for users command)' },
  { name: 'user',  alias: 'u', type: String,  description: 'specify user id (for user command)' },
];

const options = commandLineArgs(optionDefinitions);


function usage(){
  let usageText = getUsage([{
    header: 'Usage',
    content: './index.js <operation> -p [-s|t|r] <options>'
  }, {
    header: 'Description',
    content: 'Perform bulk replication operations'
  }, {
    header: 'Options',
    optionList: optionDefinitions
  }, {
    header: 'Operations',
    content: [
      'list      - list of active replications. require param -r',
      'dblist    - list of databases. require param -s',
      'users     - list of users for db. require param -s, -d',
      'user      - get user info. require param -s, -u',
      'copy      - same as replicate',
      'replicate - replicate databases. require -s and -t',
      'copyusers - replicate users. require -s and -t',
      'removeall - remove ALL dbs! require -t',
    ]
  }, {
    header: 'Examples:',
    content: {
      options: {
        noTrim: true
      },
      data: [
        {col:'Replicate dbs:'},
        {col: "  node index replicate -p 'test1-' -s http://user:pass@172.16.16.84:5984 -t http://user:pass@172.16.16.84:5986"},
        {col:''},

        {col:'Replicate with users dbs:'},
        {col: "  node index replicate -p 'test1-' -s http://user:pass@172.16.16.84:5984 -t http://user:pass@172.16.16.84:5986  --withusers --newprefix 'copy1-'"},
        {col:''},

        {col:'Copy users:'},
        {col: "  node index copyusers -p 'test1-' -s http://user:pass@172.16.16.84:5984 -t http://user:pass@172.16.16.84:5986 --newprefix 'copy1-'"},
        {col:''},

        {col:'Db list:'},
        {col: "  node index dblist -p 'test1-' -s http://user:pass@172.16.16.84:5984"},
        {col:''},

        {col:'List active replications'},
        {col:"  node index list -p 'test1-' -r http://user:pass@172.16.16.84:5984"},
        {col:''},

        {col:'Delete all dbs in the scope'},
        {col:"  node index removeall -p 'test1-' -t http://user:pass@172.16.16.84:5984"}

      ]
    }
  }]);
  console.log(usageText);
}



function printError(e){
  console.error('%s: %s', e.code || 'Error', e.message || e.description );
  console.error('\n');
  console.error( e );
}

function printEnv(options){
  if(!options.silent){
    console.log('  Replicator: ', scrub(options.replicator) );
    console.log('      Prefix: ', options.prefix);
    console.log('   Operation: ', options.operation);
    console.log('      Source: ', scrub(options.src) );
    console.log('      Target: ', scrub(options.target) );
    console.log('');
  }
}

function scrub(str) {
  if (str) {
    str = str.replace(/\/\/(.*)@/,"//XXXXXX:XXXXXX@");
  }
  return str;
}

///////////////////////////
process.on('uncaughtException', printError);
process.on('unhandledRejection', printError);

if(options.help || !options.operation){
  usage();
  return;
}

assert.ok(options.prefix,  'No value for: prefix. Use -p|--prefix to set it');
switch(options.operation){
  case 'list':
    operationList(options);
    break;

  case 'dblist':
    dbList(options);
    break;

  case 'copy':
  case 'replicate':
    replicate(options);
    break;

  case 'copyusers':
    copyUsers(options);
    break;

  case 'removeall':
    removeAll(options);
    break;

  case 'user':
    getUser(options);
    break;

  case 'users':
    getUsers(options);
    break;

  default:
    console.warn('Unknown operation:', options.operation);
}


/**
 * List active operations on replicator host
 */
function operationList(options){
  options.replicator = options.replicator || options.src || options.target || HOST_DEFAULT;
  assert.ok(options.replicator,  'No value for: replicator. Use -r|--replicator to set it');
  printEnv(options);

  Promise.resolve().then(()=>{
    let r = new Replicator(options.replicator, options.prefix);
    return r.replicationList();
  })
  .then(list=>{
    console.log('Active replications: \n' + prettyFormat(list, ['replication_id', 'source', 'target',  'continuous', 'progress', 'updated_on']) );
  });
}

/**
 * List dbs on source host
 */
function dbList(options){
  options.src = options.src || options.replicator || options.target || HOST_DEFAULT;
  assert.ok(options.src,  'No value for: source. Use -s|--src to set it');
  printEnv(options);

  Promise.resolve().then(()=>{
    let r = new Replicator(options.src, options.prefix);
    return r.dbList();
  })
  .then(list=>{
    console.log('Databases:  \n' + prettyFormatArray(list) );
    console.log('Total: ' + list.length );
  });
}



/**
 * replicate from source to target by replicator agent on replicator
 */
function replicate(options){
  options.replicator = options.replicator || options.src || HOST_DEFAULT;
  options.src = options.src || options.replicator || HOST_DEFAULT;

  assert.ok(options.replicator,  'No value for: replicator. Use -r|--replicator to set it');
  assert.ok(options.src,  'No value for: source. Use -s|--src to set it');
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');
  printEnv(options);


  Promise.resolve().then(()=>{
    let r = new Replicator(options.replicator, options.prefix);

    // log progress
    let lastOperation = '...';
    r.on('opStart', op=>{
      lastOperation = '  ' + op;
      // console.log('opStart', op);
      logger.logLOP(lastOperation + '  ...');
    });
    r.on('opProgress', progress=>{
      // console.log('opProgress', progress);
      logger.logLOP(lastOperation + '  ' + progress +' %');
    });
    r.on('opEnd', status=>{
      // console.log('opEnd', status);
      // logger.logLOP('');
      logger.log('    ' + lastOperation + '  ' + status);
      lastOperation = null;
    });
    r.on('opError', msg=>{
      logger.log('        ' + msg);
    });


    logger.startLOP();
    return r.replicate(options.src, options.target, {
      newprefix: options.newprefix,
      after: options.after,
      withusers: options.withusers
    })
    .then(()=>{
      logger.stopLOP();
      console.log('All done! Elapsed: %s ms', logger.elapsedLOP() );
    });
  });
}




/**
 * remove all dbs on target
 */
function removeAll(options){
  options.target = options.target || options.src || HOST_DEFAULT;
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');
  printEnv(options);


  console.log('YOU HAVE 5 SECOND TO DISCARD REMOVING!');
  console.log('Press  Ctrl + C  to discard!');

  timeout(5000).then(()=>{
    let r = new Replicator(options.target, options.prefix);
    _bindLogger(r);
    return r.removeAll();
  })
  .then(list=>{
    console.log('All done!');
  });
}


/**
 * Copy users, related to dbs
 */
function copyUsers(options){
  options.src = options.src || options.replicator || HOST_DEFAULT;
  options.replicator = options.replicator || options.src; // Actually, no matter in this case

  assert.ok(options.src,  'No value for: source. Use -s|--src to set it');
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');
  printEnv(options);

  Promise.resolve().then(()=>{
    let r = new Replicator(options.replicator, options.prefix);
    _bindLogger(r);

    return r.copyUsers(options.src, options.target, {
      newprefix: options.newprefix,
      after: options.after
    })
    .then(()=>{
      console.log('All done!');
    });
  });
}


/**
 * @param {Replicator} replicator
 */
function _bindLogger(replicator){
  let hasProgress = false;
  replicator.on('opStart', op=>{
    process.stdout.write(' ' + op+ '... ');
  });

  replicator.on('opProgress', progress=>{
    process.stdout.write('\n   ' + (progress || 'N/A') );
    hasProgress = true;
  });
  replicator.on('opEnd', status=>{
    // console.log('opEnd', status);
    console.log( (hasProgress ? '\n   ' : '') + status);
  });
}


/**
 * get users for specified db
 */
function getUsers(options){

  options.target = options.target || options.src || options.replicator || HOST_DEFAULT;
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');
  assert.ok(options.db,  'No value for: db. Use -d|--db to set it');
  printEnv(options);

  Replicator.getDbUsers(options.target + '/' + options.db)
    .then(userData=>{
        let userList = userData.members && userData.members.names || [];
        let adminList = userData.admins && userData.admins.names || [];
        return {users: userList, admins: adminList};
    })
     .then(data=>{
      console.log('Users: \n', data );
    });
}

/**
 * get users for specified db
 */
function getUser(options){

  options.target = options.target || options.src || options.replicator || HOST_DEFAULT;
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');
  assert.ok(options.user,  'No value for: user. Use -u|--user to set it');
  printEnv(options);

  Replicator.getUser(options.target, options.user)
     .then(data=>{
      console.log('User: \n', data );
    });
}




function timeout(ms){
  return new Promise(resolve=>{ setTimeout(resolve, ms);});
}


