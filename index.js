#!/bin/env node
/* jshint esversion: 6 */
/* jshint laxbreak:true */
const commandLineArgs = require('command-line-args');
const prettyFormat = require('./lib/cli-tools.js').prettyFormat;
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
  console.log('HELP: Look into code');
}



function printError(e){
  console.error('%s: %s', e.code || 'Error', e.message || e.description );
  console.error( e );
}

function validateOptions(options){
  if(!options.prefix){
    return 'No value for: prefix. Use -p|--prefix to set it';
  }
}

function printEnv(options){
  if(!options.silent){
    console.log('  Replicator: ', options.replicator);
    console.log('      Prefix: ', options.prefix);
    console.log('   Operation: ', options.operation);
  }
}

///////////////////////////

if(options.help || !options.operation){
  usage();
  return;
}

printEnv(options);

let error = validateOptions(options);
if(error){
  printError({message:error});
  return;
}



switch(options.operation){
  case 'list':
    operationList(options);
    break;

  default:
    console.warn('unknown operation:', options.operation);
}


function operationList(options){
  Promise.resolve().then(()=>{
    let r = new Replicator(options.replicator, options.prefix);
    return r.replicationList();
  })
  .then(list=>{
    console.log('Active replications: \n' + prettyFormat(list, ['replication_id', 'source', 'target',  'continuous', 'progress', 'updated_on']) );
  })
  .catch(printError);
}
