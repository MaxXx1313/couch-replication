#!/bin/env node
/* jshint esversion: 6 */
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const prettyFormat      = require('./lib/cli-tools.js').prettyFormat;
const prettyFormatArray = require('./lib/cli-tools.js').prettyFormatArray;
const Replicator = require('./lib/replicator.js').Replicator;

const optionDefinitions = [
  { name: 'operation', type: String, defaultOption:true },
  { name: 'help',    alias: "h", type: Boolean },
  { name: 'prefix',  alias: 'p', type: String },
  { name: 'src',     alias: 's', type: String },  // url
  { name: 'target',  alias: 't', type: String },  // url
  { name: 'replicator',  alias: 'r', type: String,
    defaultValue :'http://localhost:5984' }  // url
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

  default:
    console.warn('Unknown operation:', options.operation);
}


function operationList(options){
  assert.ok(options.replicator,  'No value for: replicator. Use -r|--replicator to set it');
  assert.ok(options.prefix,  'No value for: prefix. Use -p|--prefix to set it');

  Promise.resolve().then(()=>{
    let r = new Replicator(options.replicator, options.prefix);
    return r.replicationList();
  })
  .then(list=>{
    console.log('Active replications: \n' + prettyFormat(list, ['replication_id', 'source', 'target',  'continuous', 'progress', 'updated_on']) );
  });
}


function dbList(options){
  var source = options.src || options.replicator;
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



function replicate(options){
  var replicator = options.replicator || options.src;
  var source = options.src || options.replicator;

  assert.ok(replicator,  'No value for: replicator. Use -r|--replicator to set it');
  assert.ok(source,  'No value for: source. Use -s|--src to set it');
  assert.ok(options.target,  'No value for: target. Use -t|--target to set it');

  Promise.resolve().then(()=>{
    let r = new Replicator(replicator, options.prefix);
    return r.replicate(source, options.target);
  })
  .then(list=>{
    console.log('Active replications: \n' + prettyFormat(list, ['replication_id', 'source', 'target',  'continuous', 'progress', 'updated_on']) );
  });
}
