const { createApp } = require('./app');
const port = process.env.PORT || 3000;
const server = createApp().listen(port, () =>
  console.log(`devops-lab listening on :${port} (env=${process.env.NODE_ENV || 'development'})`));

// graceful shutdown: important for Docker stop / K8s rolling updates
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
