const net = require('net');

const BACKEND_URL = (process.env.MAHI_BACKEND_URL || 'https://mahi-shah-pos-api.onrender.com').replace(/\/+$/, '');
const POLL_MS = Number(process.env.MAHI_PRINT_POLL_MS || 2000);

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function escpos(lines, cut=true){
  const chunks = [];
  chunks.push(Buffer.from([0x1b,0x40])); // initialize

  for(const line of (lines || [])){
    chunks.push(Buffer.from(String(line) + '\n', 'utf8'));
  }

  chunks.push(Buffer.from('\n\n', 'utf8'));

  if(cut){
    chunks.push(Buffer.from([0x1d,0x56,0x00]));
  }

  return Buffer.concat(chunks);
}

function sendRaw(ip, port, bytes){
  return new Promise((resolve,reject)=>{
    const socket = net.createConnection(
      {host:ip, port:Number(port||9100), timeout:7000},
      ()=>{
        socket.write(bytes, err=>{
          if(err){
            socket.destroy();
            reject(err);
            return;
          }
          socket.end();
        });
      }
    );

    socket.on('close',hadError=>{
      if(!hadError) resolve();
    });

    socket.on('timeout',()=>{
      socket.destroy();
      reject(new Error('Printer connection timeout'));
    });

    socket.on('error',reject);
  });
}

async function jsonFetch(path, options={}){
  const res = await fetch(BACKEND_URL + path, {
    ...options,
    headers:{
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  }

  return data;
}

async function processOne(){
  const data = await jsonFetch('/print-queue/next');
  const job = data.job;

  if(!job){
    return false;
  }

  try{
    if(!job.ip){
      throw new Error('Printer IP missing in print job');
    }

    console.log(`[PRINT] Job #${job.id} -> ${job.ip}:${job.port || 9100}`);
    await sendRaw(job.ip, job.port || 9100, escpos(job.lines, job.cut !== false));
    await jsonFetch(`/print-queue/${job.id}/done`, {method:'POST'});
    console.log(`[DONE] Job #${job.id}`);
  }catch(err){
    const message = err && err.message ? err.message : String(err);
    console.error(`[FAIL] Job #${job.id}: ${message}`);

    try{
      await jsonFetch(`/print-queue/${job.id}/fail`, {
        method:'POST',
        body:JSON.stringify({error:message})
      });
    }catch(reportErr){
      console.error('[FAIL REPORT]', reportErr.message || reportErr);
    }
  }

  return true;
}

async function main(){
  console.log('MAHI Central Print Bridge');
  console.log('Backend:', BACKEND_URL);
  console.log('Polling every', POLL_MS, 'ms');
  console.log('Keep this window open while the shop is operating.');

  while(true){
    try{
      const worked = await processOne();
      if(!worked) await sleep(POLL_MS);
    }catch(err){
      console.error('[QUEUE]', err.message || err);
      await sleep(Math.max(POLL_MS, 5000));
    }
  }
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
