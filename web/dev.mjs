import {loadConfiguration, startServer} from 'snowpack';
(async () => {
  const config = await loadConfiguration(
    {port: 8080, devOptions: {output: 'dashboard'}},
    'snowpack.config.js'
  );
  const server = await startServer({config});
  server.onFileChange(({filePath}) => {
    console.log({filePath});
  });
})();
