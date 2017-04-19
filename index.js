#!/bin/env node
/* jshint esversion: 6 */
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const prettyFormat      = require('./lib/cli-tools.js').prettyFormat;
const prettyFormatArray = require('./lib/cli-tools.js').prettyFormatArray;
const Replicator = require('./lib/replicator.js').Replicator;

const singleLog = require('single-line-log').stdout;

const LopConsole = require('./lib/LopConsole');
const logger = new LopConsole();

const HOST_DEFAULT = 'http://localhost:5984';

const optionDefinitions = [
  { name: 'operation', type: String, defaultOption:true }, // operation
  { name: 'help',    alias: "h", type: Boolean },          // print help
  { name: 'prefix',  alias: 'p', type: String },          // db prefix
  { name: 'src',     alias: 's', type: String },          // replication source url
  { name: 'target',  alias: 't', type: String },          // replication target url
  { name: 'replicator',  alias: 'r', type: String },      // (optional) replicator host url. default is host
  { name: 'newprefix',  type: String },                   // (optional) change prefix to this one
  { name: 'after',  type: String }                        // (optional) resule replication since that name
];

const options = commandLineArgs(optionDefinitions);


function usage(){
  console.log('HELP: Look into thecode');
}



function printError(e){
  console.error('%s: %s', e.code || 'Error', e.message || e.description );
  console.error('\n');
  console.error( e );
}

function printEnv(options){
  if(!options.silent){
    console.log('  Replicator: ', options.replicator);
    console.log('      Prefix: ', options.prefix);
    console.log('   Operation: ', options.operation);
  }
}

///////////////////////////
process.on('uncaughtException', printError);
process.on('unhandledRejection', printError);

if(options.help || !options.operation){
  usage();
  return;
}

printEnv(options);


switch(options.operation){
  case 'list':
    operationList(options);
    break;

  case 'dblist':
    dbList(options);
    break;

  case 'replicate':
    replicate(options);
    break;

  case 'delete':
    removeAll(options);
    break;

  default:
    console.warn('Unknown operation:', options.operation);
}


/**
 *
 */
function operationList(options){
  let replicator = options.replicator || options.src || options.target || HOST_DEFAULT;
  assert.ok(replicator,  'No value for: replicator. Use -r|--replicator to set it');
  assert.ok(options.prefix,  'No value for: prefix. Use -p|--prefix to set it');


  Promise.resolve().then(()=>{
    let r = new Replicator(replicator, options.prefix);
    return r.replicationList();
  })
  .then(list=>{
    console.log('Active replications: \n' + prettyFormat(list, ['replication_id', 'source', 'target',  'continuous', 'progress', 'updated_on']) );
  });
}

/**
 *
 */
function dbList(options){
  var source = options.src || options.replicator || options.target || HOST_DEFAULT;
  assert.ok(source,  'No value for: source. Use -s|--src to set it');
  assert.ok(options.prefix,  'No value for: prefix. Use -p|--prefix to set it');


  Promise.resolve().then(()=>{
    let r = new Replicator(source, options.prefix);
    return r.dbList();
  })
  .then(list=>{
    console.log('Databases: \n' + prettyFormatArray(list) );
  });
}



/**
 *
 */
function replicate(options){
  var replicator = options.replicator || options.src || HOST_DEFAULT;
  var source = options.src || options.replicator || HOST_DEFAULT;

  assert.ok(replicator,  'No value for: replicator. Use -r|--replicator to set it');
  assert.ok(source,  'No value for: source. Use -s|--src to set it');
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');


  Promise.resolve().then(()=>{
    let r = new Replicator(replicator, options.prefix);

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


    logger.startLOP();
    return r.replicate(source, options.target, {newprefix: options.newprefix, after: options.after} )
    .then(()=>{
      logger.stopLOP();
      console.log('All done! Elapsed: %s ms', logger.elapsedLOP() );
    });
  });
}




/**
 *
 */
function removeAll(options){
  var target = options.target || options.replicator || options.src || HOST_DEFAULT;

  assert.ok(target,  'No value for: target. Use -t|--target to set it');
  console.log('YOU HAVE 5 SECOND TO DISCARD REMOVING!');
  console.log('Press  Ctrl + C  to discard!');

  timeout(5000).then(()=>{
    let r = new Replicator(target, options.prefix);

    r.on('opStart', op=>{
      process.stdout.write(' ' + op+ '...');
    });
    r.on('opEnd', status=>{
      // console.log('opEnd', status);
      console.log(status);
    });

    return r.removeAll();
  })
  .then(list=>{
    console.log('All done!');
  });
}


function timeout(ms){
  return new Promise(resolve=>{ setTimeout(resolve, ms);});
}
