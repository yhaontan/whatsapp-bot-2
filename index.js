// index.js – בוט וואטסאפ רב-חשבוני עם תפריט ניהול מלא בעברית

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const crypto = require('crypto');
const schedule = require('node-schedule');

// ----------- הגדרות וקונפיג -----------
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (err) {
    console.error('❌ שגיאה בטעינת config.json:', err.message);
    process.exit(1);
  }
}
let config = loadConfig();
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

// ----------- לוגים -----------
function writeLog(text) {
const line = `${new Date().toISOString()} | ${text}\n`;
  fs.appendFileSync('bot.log', line);
  console.log('[LOG]', text);
}

// ----------- סטטיסטיקה -----------
let stats = {};
const statsPath = 'stats.json';
if (fs.existsSync(statsPath)) {
  stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}
function updateStats(group, qr) {
  const day = new Date().toISOString().slice(0, 10);
  stats[day] = stats[day] || {};
  stats[day][group] = stats[day][group] || { messages: 0, qrs: {} };
  stats[day][group].messages++;
  stats[day][group].qrs[qr] = (stats[day][group].qrs[qr] || 0) + 1;
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

// ----------- זיהוי כפילויות -----------
const recentHashes = new Set();
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// ----------- ניהול QR-ים מרובים -----------
const QR_ACCOUNTS = config.QR_ACCOUNTS || ['main'];
const bots = {};
const readyBots = [];
const activeQRs = {}; // שמירת קודי QR פעילים
const qrIntervals = {}; // שמירת מזהי האינטרוולים
let lastQRIndex = -1; // בשביל איזון רנדומלי

function showQRCode(session, qr) {
  console.log(`\n🔑 סרוק QR עבור החשבון: ${session}`);
  qrcode.generate(qr, { small: true });
}

function setupQRRepeat(session, qr) {
  // נקה אינטרוול קודם אם קיים
  if (qrIntervals[session]) {
    clearInterval(qrIntervals[session]);
  }
  
  // שמור את קוד ה-QR
  activeQRs[session] = qr;
  
  // הגדר שליחה חוזרת כל 20 שניות
  qrIntervals[session] = setInterval(() => {
    if (!readyBots.includes(session)) {
      console.log(`\n🔄 שליחת QR מחדש עבור החשבון: ${session}`);
      showQRCode(session, activeQRs[session]);
    } else {
      clearInterval(qrIntervals[session]);
      qrIntervals[session] = null;
    }
  }, 20000);
}

for (const session of QR_ACCOUNTS) {
  bots[session] = new Client({
    authStrategy: new LocalAuth({ clientId: session }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  bots[session].on('qr', qr => {
    showQRCode(session, qr);
    setupQRRepeat(session, qr);
  });

  bots[session].on('ready', async () => {
    if (!readyBots.includes(session)) readyBots.push(session);
    console.log(`✅ חשבון ${session} מוכן`);
    writeLog(`חשבון ${session} מוכן`);
    
    // בטל את השליחה החוזרת כאשר החשבון מוכן
    if (qrIntervals[session]) {
      clearInterval(qrIntervals[session]);
      qrIntervals[session] = null;
    }
  });

  bots[session].on('disconnected', reason => {
    writeLog(`❗️${session} נותק. סיבה: ${reason}`);
    const i = readyBots.indexOf(session);
    if (i > -1) readyBots.splice(i, 1);
    setTimeout(() => {
      writeLog(`🔄 מנסה להתחבר מחדש: ${session}`);
      bots[session].initialize();
    }, 7000);
  });

  bots[session].on('auth_failure', msg => {
    writeLog(`❌ ${session} כשל באימות: ${msg}`);
    // נסיון חיבור מחדש אחרי שגיאת אימות
    setTimeout(() => {
      writeLog(`🔄 מנסה להתחבר מחדש אחרי כשל אימות: ${session}`);
      bots[session].initialize();
    }, 10000);
  });

  bots[session].initialize();
}

// שליחה רנדומלית מאוזנת בין QR-ים
function getNextReadyQR() {
  if (readyBots.length === 0) return null;
  lastQRIndex = (lastQRIndex + 1) % readyBots.length;
  return readyBots[lastQRIndex];
}

// שליחת הודעה לקבוצות יעד
async function sendMessageToTargets(content, isMedia, senderPhone) {
  let success = true;
  let usedQRs = [];
  for (const group of config.TARGET_GROUP_NAMES) {
    const qr = getNextReadyQR();
    if (!qr) {
      writeLog('❌ אין חשבונות QR זמינים!');
      success = false;
      continue;
    }
    try {
      const allChats = await bots[qr].getChats();
      const target = allChats.find(c => c.isGroup && c.name === group);
      if (!target) {
        writeLog(`❌ לא נמצא יעד: "${group}" בחשבון ${qr}`);
        success = false;
        continue;
      }
      if (isMedia) {
        await target.sendMessage(content.media, { caption: content.caption });
      } else {
        await target.sendMessage(content);
      }
      writeLog(`✅ נשלח ל "${group}" ע"י ${senderPhone} ב-QR ${qr}`);
      updateStats(group, qr);
      usedQRs.push(qr);
    } catch (e) {
      writeLog(`❌ שגיאה בשליחה ל "${group}" ב-QR ${qr}: ${e.message}`);
      success = false;
    }
  }
  return success;
}

// ---------- תפריט ראשי – מערכת תפריטים למשתמשים ----------
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

להפעלת תפריט: כתוב "תפריט"
לפעולה: כתוב רק את המספר 👆
`;

// דוחות סטטיסטיים
async function sendWeeklyStats() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
  const statsMsg = [];

  Object.keys(stats).forEach(day => {
    const date = new Date(day);
    if (date >= weekAgo) {
      statsMsg.push(`📅 ${day}:\n` +
        Object.entries(stats[day]).map(([group, data]) =>
          `${group}: ${data.messages} הודעות (${Object.entries(data.qrs).map(([q,n])=>`${q}: ${n}`).join(', ')})`
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

// עיקרי הטיפול בפקודות ומצבים (תפריט מרכזי)
for (const qr of QR_ACCOUNTS) {
  bots[qr].on('message_create', async msg => {
    try {
      const chat = await msg.getChat();
      const senderId = msg.from.split('@')[0];
      const senderPhone = senderId.startsWith('972') ? '0' + senderId.slice(3) : senderId;

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
        switch(num) {
          case '1': // הוספת קבוצה
            userStates[senderPhone] = { step: 'add-group' };
            await msg.reply('כתוב את *שם הקבוצה* להוספה:');
            break;
          case '2': // הסרת קבוצה
            if (!config.TARGET_GROUP_NAMES.length) {
              await msg.reply('אין קבוצות להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.TARGET_GROUP_NAMES.map((g,i)=>`${i+1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-group' };
              await msg.reply(`בחר קבוצה להסרה (שלח את המספר):\n${list}`);
            }
            break;
          case '3': // הוספת מורשה
            userStates[senderPhone] = { step: 'add-authorized' };
            await msg.reply('כתוב את המספר המלא (ללא רווחים) להוספה:');
            break;
          case '4': // הסרת מורשה
            if (!config.AUTHORIZED_SENDERS.length) {
              await msg.reply('אין מורשים להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.AUTHORIZED_SENDERS.map((g,i)=>`${i+1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-authorized' };
              await msg.reply(`בחר מורשה להסרה (שלח את המספר):\n${list}`);
            }
            break;
          case '5': // סטטיסטיקה
            await sendWeeklyStats();
            await msg.reply('סטטיסטיקה נשלחה.');
            userStates[senderPhone] = null;
            break;
          case '6': // ניהול QR
            const qrList = config.QR_ACCOUNTS.map((g,i)=>`${i+1}. ${g}`).join('\n');
            userStates[senderPhone] = { step: 'qr-menu' };
            await msg.reply(`ניהול QR:\n${qrList}\nשלח 1 להוספת QR, 2 להסרת QR`);
            break;
          case '7':
            await msg.reply('זה תפריט ניהול בוט מתקדם – כתוב "תפריט" בכל שלב לתפריט הראשי.');
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
        // הוספת קבוצה
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
        // הסרת קבוצה
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
        // הוספת מורשה
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
        // הסרת מורשה
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
        // QR MENU
        if (state.step === 'qr-menu') {
          if (msg.body.trim() === '1') {
            userStates[senderPhone] = { step: 'add-qr' };
            await msg.reply('כתוב את שם ה־QR להוספה:');
          } else if (msg.body.trim() === '2') {
            if (!config.QR_ACCOUNTS.length) {
              await msg.reply('אין QR להסרה.');
              userStates[senderPhone] = null;
            } else {
              const list = config.QR_ACCOUNTS.map((g,i)=>`${i+1}. ${g}`).join('\n');
              userStates[senderPhone] = { step: 'remove-qr' };
              await msg.reply(`בחר QR להסרה (שלח את המספר):\n${list}`);
            }
          } else {
            await msg.reply('שלח 1 להוספת QR, 2 להסרת QR');
          }
          return;
        }
        // הוספת QR
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
        // הסרת QR
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

      // טיפול רגיל – הפצת הודעות (גם מדיה)
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

        writeLog('🔄 הפצת מדיה לקבוצות...');
        const result = await sendMessageToTargets({ media: mediaMsg, caption: config.SIGNATURE }, true, senderPhone);
        fs.unlinkSync(filePath);
        await msg.react(result ? '✔️' : '❌');
      } else {
        const hash = hashContent(msg.body + config.SIGNATURE);
        if (recentHashes.has(hash)) {
          writeLog('⚠️ כפילות טקסט – לא נשלח שוב');
          await msg.react('❌');
          return;
        }
        recentHashes.add(hash);

        writeLog('🔄 הפצת טקסט לקבוצות...');
        const result = await sendMessageToTargets(msg.body + config.SIGNATURE, false, senderPhone);
        await msg.react(result ? '✔️' : '❌');
      }
    } catch (err) {
      writeLog('שגיאה לא צפויה: ' + err.message);
    }
  });
}

// ניטור דפדפנים כל דקה
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

// תזמון שליחה אוטומטית של סטטיסטיקה כל יום ראשון ב־10:00
schedule.scheduleJob({ hour: 10, minute: 0, dayOfWeek: 0 }, async () => {
  console.log('🕙 שליחת סטטיסטיקה שבועית אוטומטית');
  await sendWeeklyStats();
});

// -- הפעלה אוטומטית! --
console.log('הבוט נטען...');
