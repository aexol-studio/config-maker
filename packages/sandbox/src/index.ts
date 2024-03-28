#!/usr/bin/env node

import { config } from '@/config.js';
import yargs from 'yargs';

yargs(process.argv.slice(2))
  .usage('Usage: $0 <command> [options]')
  .version(false)
  .help('h')
  .alias('h', 'help')
  .command(
    'init',
    'Configure current folder.',
    async (yargs) => {
      yargs.options(config.commandLineOptionsForYargs(['vv', 'urlOrPath']));
    },
    async (argv) => {
      const v = await config.getValue('vv', {
        commandLineProvidedOptions: argv,
      });
      console.log(v);
      return;
    },
  )
  .showHelpOnFail(true)
  .demandCommand()
  .version()
  .epilog('Bye!').argv;
