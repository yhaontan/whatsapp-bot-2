const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const crypto = require('crypto');
const schedule = require('node-schedule');

// Load config
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (err) {
    console.error('❌ שגיאה בטעינת config.json:', err.message);
    process.exit(1);
  }
}
let config = loadConfig();
fs.watchFile(path.join(__dirname, 'config.json'), () => {
  try {
    config = loadConfig();
    console.log('🔄 config.json רוענן');
  } catch (err) {
    console.error('❌ שגיאה בעדכון config.json:', err.message);
  }
});

// Logs
function writeLog(text) {
  const line = `${new Date().toISOString()} | ${text}\n`;
  fs.appendFileSync('bot.log', line);
  console.log('[LOG]', text);
}

// Stats
let stats = {};
const statsPath = 'stats.json';
if (fs.existsSync(statsPath)) {
  stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}
function updateStats(group) {
  const day = new Date().toISOString().slice(0, 10);
  stats[day] = stats[day] || {};
  stats[day][group] = stats[day][group] || { messages: 0 };
  stats[day][group].messages++;
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

// Hash duplicates
const recentHashes = new Set();
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Client init
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: getChromePath() // הפעלת הגדרה מותאמת לדפדפן קיים
  }
});

// Get Chrome or fallback to Chromium
function getChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (let p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  console.warn('⚠️ Chrome לא נמצא, puppeteer ינסה להוריד Chromium');
  return undefined;
}

// QR
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('📲 סרוק את קוד ה־QR');
});

// Ready
client.on('ready', async () => {
  console.log('✅ הבוט מחובר ומוכן!');
  writeLog('הבוט התחבר בהצלחה');
});

// ניתוק
client.on('disconnected', reason => {
  writeLog('🔌 נותק: ' + reason);
  console.log('🚫 נותק, מנסה להתחבר שוב...');
  client.initialize();
});

// שגיאות כלליות
client.on('auth_failure', msg => {
  writeLog('❌ כשל באימות: ' + msg);
});

process.on('uncaughtException', err => {
  writeLog(`❌ שגיאה לא מטופלת: ${err.message}`);
});

process.on('unhandledRejection', reason => {
  writeLog(`❌ דחייה לא מטופלת: ${reason}`);
});

// שליחה
async function sendMessageToTargets(content, isMedia, senderPhone) {
  const allChats = await client.getChats();
  const targets = allChats.filter(c =>
    c.isGroup &&
    (config.TARGET_GROUP_NAMES.includes(c.name))
  );
  let allSuccess = true;

  for (const group of targets) {
    try {
      if (isMedia) {
        await group.sendMessage(content.media, { caption: content.caption });
      } else {
        await group.sendMessage(content);
      }
      writeLog(`✅ נשלח ל "${group.name}" על ידי ${senderPhone}`);
      updateStats(group.name);
    } catch (e) {
      writeLog(`❌ שגיאה בשליחה ל "${group.name}": ${e.message}`);
      allSuccess = false;
    }
  }
  return allSuccess;
}

// קבלת הודעה
client.on('message_create', async msg => {
  const chat = await msg.getChat();
  const senderId = msg.from.split('@')[0];
  const senderPhone = senderId.startsWith('972') ? '0' + senderId.slice(3) : senderId;

  if (!config.AUTHORIZED_SENDERS.includes(senderPhone)) return;

  if (chat.name !== config.SHIGUR_GROUP) return;

  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    const hash = hashContent(media.data);
    if (recentHashes.has(hash)) return;
    recentHashes.add(hash);

    const ext = mime.extension(media.mimetype);
    const filePath = `temp.${ext}`;
    fs.writeFileSync(filePath, media.data, 'base64');
    const mediaMsg = MessageMedia.fromFilePath(filePath);

    const result = await sendMessageToTargets({ media: mediaMsg, caption: config.SIGNATURE }, true, senderPhone);
    fs.unlinkSync(filePath);
    msg.reply(result ? '✅ הופץ בהצלחה' : '⚠️ חלק נכשל');
  } else {
    const hash = hashContent(msg.body + config.SIGNATURE);
    if (recentHashes.has(hash)) return;
    recentHashes.add(hash);

    const result = await sendMessageToTargets(msg.body + config.SIGNATURE, false, senderPhone);
    msg.reply(result ? '✅ הופץ בהצלחה' : '⚠️ חלק נכשל');
  }
});

// ניטור קבוע
setInterval(() => {
  if (!client.pupBrowser) {
    writeLog('🚫 דפדפן לא מחובר');
  } else {
    console.log('🟢 דפדפן פעיל');
  }
}, 60000);

// הפעלה
client.initialize();
