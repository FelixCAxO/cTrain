import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: 'linked',
  minify: true,
  metafile: true
}).then(async (result) => {
  await import('node:fs/promises').then((fs) =>
    fs.writeFile('dist/meta.json', JSON.stringify(result.metafile, null, 2))
  );
});
