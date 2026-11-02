import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

// Test-only entry: app config/.env and VITE_* credentials are not loaded.
const server=await createServer({
 root:fileURLToPath(new URL('../../',import.meta.url)),configFile:false,
 envPrefix:'LAWROOM_UI_TEST_',envDir:fileURLToPath(new URL('./empty-env/',import.meta.url)),
 server:{host:'127.0.0.1',port:5198,strictPort:true},appType:'mpa',
});
await server.listen();server.printUrls();
console.log('Synthetic UI only: /tests/ui/tracking-workspace.html');
process.on('SIGINT',async()=>{await server.close();process.exit(0);});
