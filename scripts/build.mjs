import {build} from 'esbuild';
await build({entryPoints:['src/main.tsx'],outfile:'app.js',bundle:true,minify:true,charset:'utf8',format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
