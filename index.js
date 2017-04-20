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
    console.log('  Replicator: ', scrub(options.replicator) );
    console.log('      Prefix: ', options.prefix);
    console.log('   Operation: ', options.operation);
    console.log('      Source: ', scrub(options.src) );
    console.log('      Target: ', scrub(options.target) );
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

  case 'replicate':
    replicate(options);
    break;

  case 'removeall':
    removeAll(options);
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


    logger.startLOP();
    return r.replicate(options.src, options.target, {
      newprefix: options.newprefix,
      after: options.after
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
