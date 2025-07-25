const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const crypto = require('crypto');
const schedule = require('node-schedule');

// ----------- קונפיג והגדרות -----------

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (err) {
    console.error('❌ שגיאה בטעינת config.json:', err.message);
    process.exit(1);
  }
}
let config = loadConfig();
if (!config.SHIGUR_GROUP) config.SHIGUR_GROUP = 'ניסוי 2';

function saveConfig() {
  try {
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
    console.log('🔄 config.json נשמר');
  } catch (err) {
    console.error('❌ שגיאה בשמירת config.json:', err.message);
  }
}
fs.watchFile(path.join(__dirname, 'config.json'), () => {
  try {
    config = loadConfig();
    console.log('🔄 config.json רוענן');
  } catch (err) {
    console.error('❌ שגיאה בעדכון config.json:', err.message);
  }
});

// ----------- חתימות -----------

const SIGNATURES = {
  whatsapp: "\n🚀 הצטרפו לוואטסאפ: https://chat.whatsapp.com/HOOrIZihtW9BmtfiXvM9WW",
  telegram: "\n🚀 הצטרפו לטלגרם: https://t.me/news555news555",
  default: "\n🚀 הצטרפו לקבלת עדכונים חמים: https://chat.whatsapp.com/HOOrIZihtW9BmtfiXvM9WW"
};
function getSignature(platform) {
  return SIGNATURES[platform] || SIGNATURES.default;
}

// ----------- לוגים -----------

function writeLog(text) {
  const line = `${new Date().toISOString()} | ${text}\n`;
  fs.appendFileSync('bot.log', line);
  console.log('[LOG]', text);
}

// ----------- סטטיסטיקה -----------

let stats = {};
const statsPath = path.join(__dirname, 'stats.json');
if (fs.existsSync(statsPath)) stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
function updateStats(group, qr) {
  const day = new Date().toISOString().slice(0, 10);
  stats[day] = stats[day] || {};
  stats[day][group] = stats[day][group] || { messages: 0, qrs: {} };
  stats[day][group].messages++;
  stats[day][group].qrs[qr] = (stats[day][group].qrs[qr] || 0) + 1;
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}
async function sendWeeklyStats() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const statsMsg = [];

  Object.keys(stats).forEach(day => {
    const date = new Date(day);
    if (date >= weekAgo) {
      statsMsg.push(`📅 ${day}:\n` +
        Object.entries(stats[day]).map(([group, data]) =>
          `${group}: ${data.messages} הודעות (${Object.entries(data.qrs).map(([q, n]) => `${q}: ${n}`).join(', ')})`
        ).join('\n')
      );
    }
  });

  if (statsMsg.length === 0) return;

  // שולח בקבוצת שיגור
  for (const qr of readyBots) {
    const chats = await bots[qr].getChats();
    const shigur = chats.find(c => c.name === config.SHIGUR_GROUP);
    if (shigur) {
      await shigur.sendMessage('📊 סטטיסטיקה שבועית:\n\n' + statsMsg.join('\n\n'));
      break;
    }
  }
}

// ----------- זיהוי כפילויות -----------

const recentHashes = new Set();
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// ----------- המרות מזהים -----------

function idToPhone(id) {
  return id.startsWith('972') ? '0' + id.slice(3) : id;
}
function phoneToId(phone) {
  return (phone.startsWith('0') ? '972' + phone.slice(1) : phone) + '@c.us';
}

// ----------- ניהול QR-ים מרובים -----------

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const latestQrAscii = {}; // מחזיק QRים לפי שם סשן
const clients = {};
const sessionNames = ['main', 'main 2']; // 🟢 כאן תוסיף כמה סשנים שאתה רוצה

// יצירת כל הסשנים
sessionNames.forEach(sessionName => {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionName }),
    puppeteer: { headless: true },
  });

  // אחסון הלקוח
  clients[sessionName] = client;

  // שמירת ה־QR בקונסול וב־זיכרון
  client.on('qr', qr => {
    const ascii = qrcode.generate(qr, { small: true });
    console.log(`🔑 [${sessionName}] QR:\n`, ascii);
    latestQrAscii[sessionName] = ascii;
  });

  // התחברות
  client.on('ready', () => {
    console.log(`✅ [${sessionName}] מוכן!`);
  });

  client.initialize();
});

// ============================
// קוד התגובה על הודעה: שלח QR לפי סשן
// ============================

// זה דוגמה עם הסשן הראשי 'main'. אתה יכול לשלב את זה בתוך כל listener שלך
clients['main'].on('message', async msg => {
  const sender = msg.from;
  const text = msg.body?.trim();

  if (text === '8') {
    const session = getNextReadyQR();
    const ascii = latestQrAscii[session];

    if (ascii) {
      await msg.reply(`📱 סרוק את ה-QR הבא להתחברות לחשבון (${session}):\n\n\`\`\`\n${ascii}\n\`\`\``);
    } else {
      await msg.reply('❌ עדיין לא נוצר QR – נסה שוב בעוד רגע.');
    }
  }
});

// מחזיר שם של סשן שיש לו QR מוכן
function getNextReadyQR() {
  return Object.keys(latestQrAscii)[0] || null;
}
    // --- הדפסת כל שמות הקבוצות לחשבון זה ---
    const chats = await bots[session].getChats();
    console.log('----- כל שמות הקבוצות בוואטסאפ (debug) -----');
    chats.filter(c => c.isGroup).forEach(g => console.log('"' + g.name + '"'));
  ;


  bots[session].on('disconnected', reason => {
    writeLog(`❗️${session} נותק. סיבה: ${reason}`);
    const i = readyBots.indexOf(session);
    if (i > -1) readyBots.splice(i, 1);
    setTimeout(() => bots[session].initialize(), 7000);
  });

  bots[session].on('auth_failure', msg => {
    writeLog(`❌ ${session} כשל באימות: ${msg}`);
  });

  bots[session].initialize();


function getNextReadyQR() {
  if (readyBots.length === 0) return null;
  lastQRIndex = (lastQRIndex + 1) % readyBots.length;
  return readyBots[lastQRIndex];
}

// ----------- שליחת הודעה לקבוצות יעד -----------

async function sendMessageToTargets(content, isMedia, senderPhone) {
  let success = true;
  const fails = [];
  for (const group of config.TARGET_GROUP_NAMES) {
    const qr = getNextReadyQR();
    if (!qr) {
      writeLog('❌ אין חשבונות QR זמינים!');
      fails.push(group); success = false;
      continue;
    }
    try {
      const allChats = await bots[qr].getChats();
      const target = allChats.find(c => c.isGroup && c.name === group);
      if (!target) {
        writeLog(`❌ לא נמצא יעד: "${group}" בחשבון ${qr}`);
        fails.push(group); success = false;
        continue;
      }
      if (isMedia) {
        await target.sendMessage(content.media, { caption: content.caption });
      } else {
        await target.sendMessage(content);
      }
      writeLog(`✅ נשלח ל "${group}" ע\"י ${senderPhone} ב-QR ${qr}`);
      updateStats(group, qr);
    } catch (e) {
      writeLog(`❌ שגיאה בשליחה ל "${group}" ב-QR ${qr}: ${e.message}`);
      fails.push(group); success = false;
    }
  }
  writeLog(fails.length ? `❌ כשלונות: ${fails.join(', ')}` : '✅ הופץ לכל היעדים');
  return success;
}

// ----------- תפריט ראשי – מערכת תפריטים למשתמשים -----------

let userStates = {};

const menuText = `
*📋 תפריט ראשי – ניהול בוט:*
1️⃣ הוספת קבוצה יעד
2️⃣ הסרת קבוצה יעד
3️⃣ הוספת מורשה לשליחה
4️⃣ הסרת מורשה לשליחה
5️⃣ סטטיסטיקה (שבועית/יומית)
6️⃣ QR – ניהול חשבונות שליחה
7️⃣ עזרה
8️⃣ הצגת QR לסריקה

להפעלת תפריט: כתוב "תפריט"
לפעולה: כתוב רק את המספר 👆
`;

client.on('message', async msg => {
  console.log('📨 קיבלתי הודעה!');
});
// ----------- טיפול בפקודות ובמצבים (תפריט מרכזי) -----------

for (const qr of QR_ACCOUNTS) {
  bots[qr].on('message_create', async msg => {
    try {
      const chat = await msg.getChat();
      const senderId = msg.from.split('@')[0];
      const senderPhone = senderId.startsWith('972') ? '0' + senderId.slice(3) : senderId;

      // לוג על כל הודעה מקבוצת שיגור
      writeLog(`📩 הודעה מקבוצת שיגור: קבוצה "${chat.name}", שולח ${senderPhone}, תוכן: ${msg.body}`);

      // 1. בדיקת הרשאות
      if (!config.AUTHORIZED_SENDERS.includes(senderPhone)) return;
      if (chat.name !== config.SHIGUR_GROUP) return;

      // 2. תפריט ראשי
      if (msg.body.trim() === 'תפריט') {
        userStates[senderPhone] = { step: 'main-menu' };
        await msg.reply(menuText);
        return;
      }

      // 3. פעולה מהירה מהתפריט
      if (userStates[senderPhone] && userStates[senderPhone].step === 'main-menu') {
        const num = msg.body.trim();
        switch (num) {
          case '1':
            userStates[senderPhone] = { step: 'add-group' };
            await msg.reply('כתוב את *שם הקבוצה* להוספה:');
            break;
          case '2':
            if (!config.TARGET_GROUP_NAMES.length) {
              await msg.reply('אין קבוצות להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.TARGET_GROUP_NAMES.map((g, i) => `${i + 1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-group' };
              await msg.reply(`בחר קבוצה להסרה (שלח את המספר):\n${list}`);
            }
            break;
          case '3':
            userStates[senderPhone] = { step: 'add-authorized' };
            await msg.reply('כתוב את המספר המלא (ללא רווחים) להוספה:');
            break;
          case '4':
            if (!config.AUTHORIZED_SENDERS.length) {
              await msg.reply('אין מורשים להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.AUTHORIZED_SENDERS.map((g, i) => `${i + 1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-authorized' };
              await msg.reply(`בחר מורשה להסרה (שלח את המספר):\n${list}`);
            }
            break;
          case '5':
            await sendWeeklyStats();
            await msg.reply('סטטיסטיקה נשלחה.');
            userStates[senderPhone] = null;
            break;
          case '6':
            const qrList = config.QR_ACCOUNTS.map((g, i) => `${i + 1}. ${g}`).join('\n');
            userStates[senderPhone] = { step: 'qr-menu' };
            await msg.reply(`ניהול QR:\n${qrList}\nשלח 1 להוספת QR, 2 להסרת QR`);
            break;
          case '7':
            await msg.reply('זה תפריט ניהול בוט מתקדם – כתוב "תפריט" בכל שלב לתפריט הראשי.');
            userStates[senderPhone] = null;
            break;
                    case '8':
          // שליחת QR ascii למורשה
          const session = getNextReadyQR();
          const ascii = latestQrAscii[session];
          if (ascii) {
            await msg.reply(`📱 סרוק את ה-QR הבא להתחברות לחשבון (${session}):\n\n` + '```\n' + ascii + '\n```');
          } else {
            await msg.reply('❌ עדיין לא נוצר QR – נסה שוב בעוד רגע.');
          }
          userStates[senderPhone] = null;
          break;

          default:
            await msg.reply('אנא שלח מספר מתפריט הפעולות.');
        }
        return;
      }

      // 4. טיפול בכל שלב אפשרי
      const state = userStates[senderPhone];
      if (state) {
        if (state.step === 'add-group') {
          if (!config.TARGET_GROUP_NAMES.includes(msg.body.trim())) {
            config.TARGET_GROUP_NAMES.push(msg.body.trim());
            saveConfig();
            await msg.reply(`הקבוצה "${msg.body.trim()}" נוספה.`);
          } else {
            await msg.reply('הקבוצה כבר קיימת.');
          }
          userStates[senderPhone] = null;
          return;
        }
        if (state.step === 'remove-group') {
          const idx = parseInt(msg.body.trim()) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < config.TARGET_GROUP_NAMES.length) {
            const removed = config.TARGET_GROUP_NAMES.splice(idx, 1);
            saveConfig();
            await msg.reply(`הקבוצה "${removed[0]}" הוסרה.`);
          } else {
            await msg.reply('מספר לא תקין.');
          }
          userStates[senderPhone] = null;
          return;
        }
        if (state.step === 'add-authorized') {
          if (!config.AUTHORIZED_SENDERS.includes(msg.body.trim())) {
            config.AUTHORIZED_SENDERS.push(msg.body.trim());
            saveConfig();
            await msg.reply(`המספר "${msg.body.trim()}" נוסף לרשימת המורשים.`);
          } else {
            await msg.reply('המספר כבר מורשה.');
          }
          userStates[senderPhone] = null;
          return;
        }
        if (state.step === 'remove-authorized') {
          const idx = parseInt(msg.body.trim()) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < config.AUTHORIZED_SENDERS.length) {
            const removed = config.AUTHORIZED_SENDERS.splice(idx, 1);
            saveConfig();
            await msg.reply(`המספר "${removed[0]}" הוסר.`);
          } else {
            await msg.reply('מספר לא תקין.');
          }
          userStates[senderPhone] = null;
          return;
        }
        if (state.step === 'qr-menu') {
          if (msg.body.trim() === '1') {
            userStates[senderPhone] = { step: 'add-qr' };
            await msg.reply('כתוב את שם ה־QR להוספה:');
          } else if (msg.body.trim() === '2') {
            if (!config.QR_ACCOUNTS.length) {
              await msg.reply('אין QR להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.QR_ACCOUNTS.map((g, i) => `${i + 1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-qr' };
              await msg.reply(`בחר QR להסרה (שלח את המספר):\n${list}`);
            }
          } else {
            await msg.reply('שלח 1 להוספת QR, 2 להסרת QR');
          }
          return;
        }
        if (state.step === 'add-qr') {
          if (!config.QR_ACCOUNTS.includes(msg.body.trim())) {
            config.QR_ACCOUNTS.push(msg.body.trim());
            saveConfig();
            await msg.reply(`QR "${msg.body.trim()}" נוסף. יש להפעיל מחדש את הבוט.`);
          } else {
            await msg.reply('QR כבר קיים.');
          }
          userStates[senderPhone] = null;
          return;
        }
        if (state.step === 'remove-qr') {
          const idx = parseInt(msg.body.trim()) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < config.QR_ACCOUNTS.length) {
            const removed = config.QR_ACCOUNTS.splice(idx, 1);
            saveConfig();
            await msg.reply(`QR "${removed[0]}" הוסר. יש להפעיל מחדש את הבוט.`);
          } else {
            await msg.reply('מספר לא תקין.');
          }
          userStates[senderPhone] = null;
          return;
        }
      }

      // הפצה - טקסט/מדיה עם לוגים
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        const hash = hashContent(media.data);
        if (recentHashes.has(hash)) {
          writeLog('⚠️ כפילות מדיה – לא נשלח שוב');
          await msg.react('❌');
          return;
        }
        recentHashes.add(hash);

        const ext = mime.extension(media.mimetype);
        const filePath = `temp.${ext}`;
        fs.writeFileSync(filePath, media.data, 'base64');
        const mediaMsg = MessageMedia.fromFilePath(filePath);

        writeLog(`🔄 הפצת מדיה לקבוצות... שולח: ${senderPhone}`);
        const result = await sendMessageToTargets({ media: mediaMsg, caption: getSignature('whatsapp') }, true, senderPhone);
        writeLog(`🔄 תוצאת הפצת מדיה: ${result ? 'הצלחה מלאה' : 'כישלון, בדוק לוג'}`);
        fs.unlinkSync(filePath);
        await msg.react(result ? '✔️' : '❌');
      } else {
        const fullMessage = msg.body + getSignature('whatsapp');
        const hash = hashContent(fullMessage);
        if (recentHashes.has(hash)) {
          writeLog('⚠️ כפילות טקסט – לא נשלח שוב');
          await msg.react('❌');
          return;
        }
        recentHashes.add(hash);

        writeLog(`🔄 הפצת טקסט לקבוצות... שולח: ${senderPhone}`);
        const result = await sendMessageToTargets(fullMessage, false, senderPhone);
        writeLog(`🔄 תוצאת הפצה: ${result ? 'הצלחה מלאה' : 'כישלון, בדוק את הלוג לעוד פרטים'}`);
        await msg.react(result ? '✔️' : '❌');
      }
    } catch (err) {
      writeLog('שגיאה לא צפויה: ' + err.message);
    }
  });
}

// ----------- ניטור דפדפנים כל דקה -----------
setInterval(() => {
  QR_ACCOUNTS.forEach(session => {
    const bot = bots[session];
    if (!bot.info) {
      writeLog(`🚫 דפדפן ${session} לא מחובר`);
    } else {
      console.log(`🟢 דפדפן פעיל: ${session}`);
    }
  });
}, 60000);

// ----------- תזמון שליחה אוטומטית של סטטיסטיקה כל יום ראשון ב־10:00 -----------
schedule.scheduleJob({ hour: 10, minute: 0, dayOfWeek: 0 }, async () => {
  console.log('🕙 שליחת סטטיסטיקה שבועית אוטומטית');
  await sendWeeklyStats();
});

// -- הפעלה אוטומטית! --
console.log('הבוט נטען...');
