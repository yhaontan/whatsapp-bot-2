// index.js — WhatsApp ⇄ Telegram Broadcaster  |  v3.5  (26-Jul-2025)

// ------------------- Imports -------------------
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const TelegramBot  = require('node-telegram-bot-api');
const fs   = require('fs'), path = require('path');
const qrcode = require('qrcode-terminal');
const mime   = require('mime-types');
const crypto = require('crypto');
const schedule = require('node-schedule');

// ------------------- Config --------------------
const CFG = path.join(__dirname,'config.json');
let config = {};  loadCfg();  fs.watchFile(CFG,loadCfg);

function loadCfg(){
  try{ config = JSON.parse(fs.readFileSync(CFG,'utf8')); }catch{ config = {}; }
  config.SHIGUR_GROUP         ??= '555 news il';
  config.TARGET_GROUP_NAMES   ??= [];
  config.AUTHORIZED_SENDERS   ??= [];
  config.WHATSAPP_QR_ACCOUNTS ??= ['main'];
  config.TELEGRAM_TOKEN       ??= '';
  config.TELEGRAM_TARGETS     ??= []; // ערוץ / קבוצה / משתמש
}
function saveCfg(){ fs.writeFileSync(CFG,JSON.stringify(config,null,2)); }

// ------------------- Helpers -------------------
const SIGN = {
  whatsapp: `
🚀 הצטרפו לוואטסאפ: https://chat.whatsapp.com/GGxUu0ArpasCOQAQLHgA8A`,
  telegram: `
🚀 הצטרפו לטלגרם`,
  default : ""
};;
const sig  = p=> SIGN[p]||'';
const md5  = d=>crypto.createHash('md5').update(d).digest('hex');
const log  = t=>{ fs.appendFileSync('bot.log',${new Date().toISOString()} | ${t}\n); console.log(t); };
const TMP  = path.join(__dirname,'tmp'); if(!fs.existsSync(TMP)) fs.mkdirSync(TMP);
const saveTmp=(b64,ext)=>{ const p=path.join(TMP,${Date.now()}.${ext}); fs.writeFileSync(p,b64,'base64'); return p; };

// ------------------- Telegram ------------------
let tbot=null;
if(config.TELEGRAM_TOKEN){
  tbot=new TelegramBot(config.TELEGRAM_TOKEN,{polling:false});
  log('🤖 Telegram bot ready');
}
async function tgSend(kind,buf,cap,fileName){
  if(!tbot) return true;
  let ok=true;
  for(const id of config.TELEGRAM_TARGETS){
    try{
      if(kind==='text')       await tbot.sendMessage(id,buf,{disable_web_page_preview:true});
      else if(kind==='photo') await tbot.sendPhoto(id,buf,{caption:cap});
      else if(kind==='video') await tbot.sendVideo(id,buf,{caption:cap});
      else                    await tbot.sendDocument(id,{source:buf,filename:fileName},{caption:cap});
    }catch(e){ ok=false; log(TG fail ${id}: ${e.message}); }
  }
  return ok;
}

// ------------------- Stats ---------------------
let stats={}; const STATS=path.join(__dirname,'stats.json');
if(fs.existsSync(STATS)) stats=JSON.parse(fs.readFileSync(STATS,'utf8'));

function bumpStat(group,qr){
  const day=new Date().toISOString().slice(0,10);
  stats[day]??={}; stats[day][group]??={messages:0,qrs:{}}; stats[day][group].messages++;
  stats[day][group].qrs[qr]=(stats[day][group].qrs[qr]||0)+1;
  fs.writeFileSync(STATS,JSON.stringify(stats,null,2));
}
function summaryStats(){
  const now=new Date(), today=now.toISOString().slice(0,10);
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-now.getDay());
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const buckets={today:{},week:{},month:{}};
  for(const [d,data] of Object.entries(stats)){
    const dObj=new Date(d);
    for(const [g,v] of Object.entries(data)){
      if(d===today)              buckets.today[g]=(buckets.today[g]||0)+v.messages;
      if(dObj>=weekStart)        buckets.week[g]=(buckets.week[g]||0)+v.messages;
      if(dObj>=monthStart)       buckets.month[g]=(buckets.month[g]||0)+v.messages;
    }
  }
  const fmt=o=>Object.entries(o).map(([g,n])=>${g}: ${n}).join('\n')||'-';
  return 📈 *סטטיסטיקה*\n*היום:*\n${fmt(buckets.today)}\n\n*השבוע:*\n${fmt(buckets.week)}\n\n*החודש:*\n${fmt(buckets.month)};
}

// ------------------- WhatsApp ------------------
const bots={}, ready=[], blocked=new Set(), qrAscii={}; let rr=0;
const nextQR=()=> ready.length? ready[(rr++)%ready.length]:null;
function blockQR(s){ blocked.add(s); const i=ready.indexOf(s); if(i>-1) ready.splice(i,1); }

for(const sess of config.WHATSAPP_QR_ACCOUNTS){
  const client=new Client({ authStrategy:new LocalAuth({clientId:sess}), puppeteer:{headless:true,args:['--no-sandbox']} });
  bots[sess]=client;
  client.on('qr',qr=>qrcode.generate(qr,{small:true},a=>{ qrAscii[sess]=a; console.log(\n🔑 QR ${sess}\n${a}); }));
  client.on('ready',()=>{ if(!blocked.has(sess)&&!ready.includes(sess)){ ready.push(sess);} log(✅ ${sess} ready); });
  client.on('disconnected',r=>{ log(❗ ${sess} disc ${r}); blockQR(sess); setTimeout(()=>client.initialize(),7000); });
  client.on('auth_failure',()=>{ log(❌ ${sess} auth fail); blockQR(sess); });
  client.initialize();
}

// ------------------- Forwarding ----------------
const recent=new Set();

async function forwardWA(groupPayload,isMedia){
  const groups = testMode ? ['ניסוי'] : config.TARGET_GROUP_NAMES;
  let ok=true;
  for(const group of groups){
  let ok=true;
  for(const group of config.TARGET_GROUP_NAMES){
    const qr=nextQR(); if(!qr){ ok=false; break;}
    try{
      const tgt=(await bots[qr].getChats()).find(c=>c.isGroup&&c.name===group);
      if(!tgt){ ok=false; continue; }
      isMedia? await tgt.sendMessage(groupPayload.media,{caption:groupPayload.caption})
              : await tgt.sendMessage(groupPayload);
      bumpStat(group,qr);
    }catch(e){ log(WA fail via ${qr}: ${e.message}); blockQR(qr); ok=false; }
  }
  return ok;
}

async function forward(payload,isMedia,kind){
  const waOK = await forwardWA(payload,isMedia);
  const tgOK = isMedia
    ? await tgSend(kind,payload.tgBuf,payload.caption,payload.fileName)
    : await tgSend('text',payload);
  return waOK && tgOK;
}

// ------------------- Admin State Machine -------
const state={};
const MENU = *📋 תפריט ניהול*
1️⃣ סטטיסטיקה
2️⃣ תזמון הודעה
3️⃣ קבוצות יעד ➕➖
4️⃣ מורשים ➕➖
5️⃣ ניהול QR
6️⃣ QR לסריקה
7️⃣ מצב בדיקה (רק "ניסוי");

function setState(phone,step,data={}){ state[phone]={step,...data}; }

// מתג בדיקה — כאשר true, ההפצה נשלחת רק לקבוצה "ניסוי"
let testMode = false;

// ------------------- Core Listener -------------
for(const sess of config.WHATSAPP_QR_ACCOUNTS){
bots[sess].on('message_create',async m=>{
try{
  const chat=await m.getChat();
  if(chat.name!==config.SHIGUR_GROUP) return;
  const phone=m.from.split('@')[0].replace(/^972/,'0');
  if(!config.AUTHORIZED_SENDERS.includes(phone)) return;

  // --- menu trigger
  if(m.body.trim()==='תפריט'){ setState(phone,'main'); await m.reply(MENU); return;}

  /* -------- Handle state -------- */
  const st=state[phone];
  if(st){
    switch(st.step){
      // 0. main
      case 'main':
        if(m.body==='1'){ await m.reply(summaryStats()); delete state[phone]; }
        else if(m.body==='2'){ setState(phone,'sched-dt'); await m.reply('📅 כתבו ‎YYYY-MM-DD HH:mm'); }
        else if(m.body==='3'){ setState(phone,'g-menu'); await m.reply('1 הוספה
2 הסרה'); }
        else if(m.body==='4'){ setState(phone,'a-menu'); await m.reply('1 הוספה
2 הסרה'); }
        else if(m.body==='5'){ setState(phone,'q-menu'); await m.reply('1 הוספת QR
2 הסרת QR'); }
        else if(m.body==='6'){ const qr=nextQR(); await m.reply(qrAscii[qr]||'—'); delete state[phone]; }
        else if(m.body==='7'){ testMode=!testMode; await m.reply(testMode?'⚙️ מצב בדיקה הופעל (רק "ניסוי")':'✅ מצב בדיקה בוטל'); delete state[phone]; }
        else await m.reply('בחר מספר 1-7');
        return;

      /* 1. Schedule */
      case 'sched-dt': {
        const ts=Date.parse(m.body.replace(' ','T')+':00'); if(isNaN(ts)){ await m.reply('❌ תבנית לא תקינה'); return;}
        st.when=new Date(ts); setState(phone,'sched-text',{when:st.when}); await m.reply('✍️ הקלד את ההודעה לתזמון'); return; }
      case 'sched-text':
        schedule.scheduleJob(st.when,()=>forward(m.body+sig('whatsapp'),false,'text'));
        await m.reply('✅ תוזמן בהצלחה'); delete state[phone]; return;

      /* 2. Groups */
      case 'g-menu':
        if(m.body==='1'){ setState(phone,'g-add'); await m.reply('שם קבוצה להוספה'); }
        else if(m.body==='2'){ if(!config.TARGET_GROUP_NAMES.length){ await m.reply('אין קבוצות'); delete state[phone]; }
          else { const list=config.TARGET_GROUP_NAMES.map((g,i)=>${i+1}. ${g}).join('\n'); setState(phone,'g-rem'); await m.reply(list+'\nמספר להסרה'); } }
        else await m.reply('בחר 1 או 2'); return;
      case 'g-add':
        if(config.TARGET_GROUP_NAMES.includes(m.body.trim())) await m.reply('כבר קיים');
        else { config.TARGET_GROUP_NAMES.push(m.body.trim()); saveCfg(); await m.reply('✅ נוסף'); }
        delete state[phone]; return;
      case 'g-rem': {
        const idx=Number(m.body)-1;
        if(idx<0||idx>=config.TARGET_GROUP_NAMES.length) await m.reply('מספר לא תקין');
        else{ const rem=config.TARGET_GROUP_NAMES.splice(idx,1); saveCfg(); await m.reply(✅ ${rem} הוסר);}
        delete state[phone]; return;}

      /* 3. Authorized */
      case 'a-menu':
        if(m.body==='1'){ setState(phone,'a-add'); await m.reply('מספר להוספה'); }
        else if(m.body==='2'){ if(!config.AUTHORIZED_SENDERS.length){ await m.reply('אין מורשים'); delete state[phone]; }
          else { const list=config.AUTHORIZED_SENDERS.map((g,i)=>${i+1}. ${g}).join('\n'); setState(phone,'a-rem'); await m.reply(list+'\nמספר להסרה'); } }
        else await m.reply('בחר 1 או 2'); return;
      case 'a-add':
        if(config.AUTHORIZED_SENDERS.includes(m.body.trim())) await m.reply('כבר קיים');
        else { config.AUTHORIZED_SENDERS.push(m.body.trim()); saveCfg(); await m.reply('✅ נוסף'); }
        delete state[phone]; return;
      case 'a-rem':{
        const idx=Number(m.body)-1;
        if(idx<0||idx>=config.AUTHORIZED_SENDERS.length) await m.reply('מספר לא תקין');
        else{ const rem=config.AUTHORIZED_SENDERS.splice(idx,1); saveCfg(); await m.reply(✅ ${rem} הוסר);} 
        delete state[phone]; return;}

      /* 4. QR */
      case 'q-menu':
        if(m.body==='1'){ setState(phone,'q-add'); await m.reply('שם session חדש (אותיות/מספרים)'); }
        else if(m.body==='2'){ if(!config.WHATSAPP_QR_ACCOUNTS.length){ await m.reply('אין QR'); delete state[phone]; }
          else { const list=config.WHATSAPP_QR_ACCOUNTS.map((q,i)=>${i+1}. ${q}).join('\n'); setState(phone,'q-rem'); await m.reply(list+'\nמספר להסרה'); } }
        else await m.reply('בחר 1 או 2'); return;
      case 'q-add':
        if(config.WHATSAPP_QR_ACCOUNTS.includes(m.body.trim())) await m.reply('כבר קיים');
        else { config.WHATSAPP_QR_ACCOUNTS.push(m.body.trim()); saveCfg(); await m.reply('✅ נוסף (דרוש restart)'); }
        delete state[phone]; return;
      case 'q-rem':{
        const idx=Number(m.body)-1;
        if(idx<0||idx>=config.WHATSAPP_QR_ACCOUNTS.length) await m.reply('מספר לא תקין');
        else{ const rem=config.WHATSAPP_QR_ACCOUNTS.splice(idx,1); saveCfg(); await m.reply(✅ ${rem} הוסר (דרוש restart));} 
        delete state[phone]; return;}
    } // switch
  } // if state

  /* -------- הפצה שוטפת -------- */
  if(m.hasMedia){
    const media=await m.downloadMedia();
    const hash=md5(media.data); if(recent.has(hash)){ await m.react('❌'); return;} recent.add(hash);
    const ext=mime.extension(media.mimetype);
    const p=saveTmp(media.data,ext);
    const mm=MessageMedia.fromFilePath(p);
    const kind=media.mimetype.startsWith('video/')?'video':media.mimetype.startsWith('image/')?'photo':'doc';
    const ok=await forward({media:mm,caption:sig('whatsapp'),tgBuf:Buffer.from(media.data,'base64'),fileName:file.${ext}},true,kind);
    fs.unlinkSync(p); await m.react(ok?'✔️':'❌');
  } else {
    const txt=m.body+sig('whatsapp');
    const hash=md5(txt); if(recent.has(hash)){ await m.react('❌'); return;} recent.add(hash);
    const ok=await forward(txt,false,'text');
    await m.react(ok?'✔️':'❌');
  }

}catch(e){ log('❌ '+e.message);} });} // for bots

// ------------------- Auto Stats ----------------
schedule.scheduleJob({hour:10,minute:0,dayOfWeek:0},async()=>{
  log('⏰ Weekly stats auto');
  const qr=nextQR(); if(!qr) return;
  try{
    const chats=await bots[qr].getChats();
    const shigur=chats.find(c=>c.isGroup&&c.name===config.SHIGUR_GROUP);
    if(shigur) await shigur.sendMessage(summaryStats());
  }catch(e){ log('stat '+e.message);}
});

// ------------------- Monitor -------------------
setInterval(()=>{ config.WHATSAPP_QR_ACCOUNTS.forEach(s=>console.log((bots[s]?.info?'🟢':'🔴')+' '+s)); },60000);

console.log('📦 Bot loaded — menu, QR-balance, schedule, stats, TG+WA ready');