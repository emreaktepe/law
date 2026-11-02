import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('../../',import.meta.url)),configFile:false,envPrefix:'LAWROOM_UI_TEST_',envDir:fileURLToPath(new URL('./empty-env/',import.meta.url)),server:{host:'127.0.0.1',port:5197,strictPort:true},appType:'mpa'});
await server.listen();server.printUrls();
console.log('Synthetic auth regressions: /tests/ui/auth-session.html');
process.on('SIGINT',async()=>{await server.close();process.exit(0);});
