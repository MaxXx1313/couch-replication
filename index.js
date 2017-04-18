#!/bin/env node
/* jshint esversion: 6 */
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
  { name: 'help',    alias: "h", type: Boolean },
  { name: 'prefix',              type: String },
  { name: 'src',     alias: 's', type: String }, // url
  { name: 'target',  alias: 't', type: Number }  // url
];

const options = commandLineArgs(optionDefinitions);


if(options.help){
  usage();
  return;
}

function usage(){
  console.log('HELP: Look into code');
}



//

