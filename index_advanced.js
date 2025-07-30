const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const TelegramBot = require('node-telegram-bot-api'); // Optional dependency
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const crypto = require('crypto');
const os = require('os');

// מידע מערכת מעודכן
const SYSTEM_INFO = {
  currentDate: new Date().toISOString().slice(0, 10),
  currentTime: new Date().toTimeString().slice(0, 8),
  israelTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toTimeString().slice(0, 5),
  timezone: 'UTC+3',
  userLogin: 'yhaontan',
  nodeVersion: process.version,
  platform: os.platform(),
  hostname: os.hostname(),
  startTime: new Date().toISOString(),
  version: 'Multi-QR-Advanced-v3.0'
};

// יצירת תיקיות נדרשות
const ensureDirectoriesExist = () => {
  const dirs = ['logs', 'temp', 'backups', 'reports', 'media', 'sessions', 'accounts', 'management'];
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true, mode: 0o755 });
        console.log(`✅ נוצרה תיקיה: ${dir}`);
      } catch (err) {
        console.log(`⚠️ לא ניתן ליצור תיקיה ${dir}: ${err.message}`);
      }
    }
  });
};
ensureDirectoriesExist();

// 🆕 קונפיג מתקדם עם Multi-QR
const CONFIG_PATH = path.join(__dirname, 'config.json');
function createDefaultConfig() {
  const defaultConfig = {
    // 🔥 הגדרות Multi-QR מתקדמות
    "QR_ACCOUNTS": [
      "main_account",
      "backup_account_1",
      "backup_account_2",
      "backup_account_3",
      "backup_account_4"
    ],
    "ACCOUNT_SETTINGS": {
      "AUTO_RECONNECT": true,
      "RECONNECT_DELAY": 30000,
      "MAX_RECONNECT_ATTEMPTS": 10,
      "HEALTH_CHECK_INTERVAL": 60000,
      "QR_TIMEOUT": 120000
    },
   
    // 🎯 הגדרות קבוצות וערוצים
    "SHIGUR_GROUP": "שיגור 555 news il",
    "MANAGEMENT_GROUP": "ניהול 555 news il",
    "TARGET_GROUP_NAMES": [
      "555 news il                             קבוצה 23",
      "555 news il                                   קבוצה 20",
      "555 news il                                     קבוצה 19",
      "555 news il                                     קבוצה 18",
      "555 news il                                        קבוצה 17",
      "555 news il                                   קבוצה 16",
      "555 news il                             קבוצה 15",
      "555 news il                           קבוצה 14",
      "555 news il                         קבוצה 12",
      "555 news il 11",
      "555 news il                             13 קבוצה",
      "555 news il                                      קבוצה 21",
      "555 news il                                   קבוצה 22"
    ],
    "TARGET_CHANNELS": [
      "555 news il - ערוץ ראשי",
      "555 news il - ערוץ עדכונים",
      "555 news il - ערוץ חדשות",
      "555 news il - ערוץ דחוף"
    ],
   
    // 🔐 הגדרות הרשאות ומנהלים
    "SUPER_ADMINS": [
      "120363419856833560",
      "18520503017489"
    ],
    "REGULAR_ADMINS": [
      "0529558056",
      "0525486144"
    ],
    "AUTHORIZED_SENDERS": [
      "120363419856833560",
      "18520503017489",
      "0529558056",
      "0525486144"
    ],
    "ALLOW_ALL_FROM_SHIGUR": true,
    "MANAGEMENT_GROUP_ONLY_ADMINS": true,
   
    // 🛡️ מערכת מניעת חסימות מתקדמת
    "ANTI_BLOCK_SYSTEM": {
      "ENABLED": true,
      "SMART_ROTATION": true,
      "LOAD_BALANCING": "intelligent", // "round_robin", "least_used", "random", "intelligent"
      "ACCOUNT_COOLDOWN": 120000, // 2 דקות בין שימושים
      "MIN_DELAY_BETWEEN_SENDS": 3000,
      "MAX_DELAY_BETWEEN_SENDS": 12000,
      "RANDOMIZE_DELAYS": true,
      "ADAPTIVE_DELAYS": true,
      "MESSAGE_LIMITS": {
        "PER_MINUTE": 5,
        "PER_HOUR": 80,
        "PER_DAY": 800
      },
      "COOLDOWN_AFTER_LIMIT": 300000, // 5 דקות
      "RETRY_FAILED_MESSAGES": true,
      "MAX_RETRIES": 3,
      "RETRY_DELAY": 60000
    },
   
    // ⚡ הגדרות ביצועים
    "PERFORMANCE": {
      "CONCURRENT_SENDS": 2,
      "BATCH_SIZE": 3,
      "SEND_DELAY": 1000,
      "CHANNELS_DELAY": 2000,
      "PARALLEL_CHANNELS": 2,
      "QUEUE_PROCESSING_INTERVAL": 5000
    },
   
    // 📱 Telegram
    "TELEGRAM_ENABLED": false,
    "TELEGRAM_BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
    "TELEGRAM_CHANNELS": [],
    "TELEGRAM_GROUPS": [],
    "TELEGRAM_ADMINS": [],
    "TELEGRAM_DELAY": 2000,
   
    // 🔧 הגדרות מערכת
    "SIGNATURE": "\n\n📢 הצטרפו לקבלת עדכונים נוספים:\nhttps://chat.whatsapp.com/HOOrIZihtW9BmtfiXvM9WW",
    "LOG_LEVEL": "DEBUG",
    "SAVE_LOGS_TO_FILE": true,
    "AUTO_SAVE_CONFIG": true,
    "SEND_TO_CHANNELS": true,
    "DETAILED_STATISTICS": true
  };
 
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  console.log(`✅ קובץ קונפיג נוצר: ${CONFIG_PATH}`);
  return defaultConfig;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('⚠️ קובץ קונפיג לא נמצא, יוצר קונפיג חדש...');
    return createDefaultConfig();
  }
  try {
    const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log('✅ קונפיג נטען בהצלחה');
    return configData;
  } catch (err) {
    console.log(`❌ שגיאה בטעינת קונפיג: ${err.message}`);
    const backupPath = path.join(__dirname, 'backups', `config_backup_${Date.now()}.json`);
    try {
      fs.writeFileSync(backupPath, fs.readFileSync(CONFIG_PATH));
      console.log(`💾 גיבוי נשמר: ${backupPath}`);
    } catch (e) {}
    return createDefaultConfig();
  }
}

// שמירת קונפיג
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    writeLog('💾 קונפיג נשמר בהצלחה', 'INFO');
    return true;
  } catch (err) {
    writeLog(`❌ שגיאה בשמירת קונפיג: ${err.message}`, 'ERROR');
    return false;
  }
}

// טעינת קונפיג
let config = loadConfig();

// 🆕 משתנים גלובליים למערכת Multi-QR
const QR_ACCOUNTS = config.QR_ACCOUNTS || ["main_account", "backup_account_1"];
const bots = {}; // אובייקט הבוטים
const readyBots = []; // מערך הבוטים המוכנים
const accountHealth = {}; // בריאות החשבונות
const accountStats = {}; // סטטיסטיקות לכל חשבון
const accountQueues = {}; // תורים לכל חשבון
const lastAccountUsed = {}; // זמן שימוש אחרון
const accountMessageCounts = {}; // מונה הודעות לכל חשבון
let telegramBot = null;
let distributionIndex = 0;
const pendingCommands = {};
const failedMessages = [];
const retryQueue = [];

// 🆕 מחלקה לניהול מערכת Anti-Block
class AdvancedAntiBlockManager {
  constructor() {
    this.accountUsage = new Map();
    this.messageHistory = new Map();
    this.cooldowns = new Map();
    this.lastActivity = new Map();
  }
 
  // בדיקה מתקדמת של זמינות חשבון
  isAccountAvailable(accountId) {
    if (!readyBots.includes(accountId)) {
      return false;
    }
   
    const now = Date.now();
    const lastUsed = this.lastActivity.get(accountId) || 0;
    const cooldownPeriod = config.ANTI_BLOCK_SYSTEM?.ACCOUNT_COOLDOWN || 120000;
   
    // בדיקת קירור בין שימושים
    if (now - lastUsed < cooldownPeriod) {
      writeLog(`⏳ חשבון ${accountId} בקירור (${Math.round((cooldownPeriod - (now - lastUsed)) / 1000)}s)`, 'DEBUG');
      return false;
    }
   
    // בדיקת מגבלות הודעות
    const limits = config.ANTI_BLOCK_SYSTEM?.MESSAGE_LIMITS || {};
    if (this.exceedsLimits(accountId, limits)) {
      writeLog(`⚠️ חשבון ${accountId} חרג ממגבלות הודעות`, 'WARN');
      return false;
    }
   
    return true;
  }
 
  // בדיקת חריגה ממגבלות
  exceedsLimits(accountId, limits) {
    const usage = this.accountUsage.get(accountId) || { minute: 0, hour: 0, day: 0 };
   
    if (limits.PER_MINUTE && usage.minute >= limits.PER_MINUTE) return true;
    if (limits.PER_HOUR && usage.hour >= limits.PER_HOUR) return true;
    if (limits.PER_DAY && usage.day >= limits.PER_DAY) return true;
   
    return false;
  }
 
  // רישום שימוש בחשבון
  recordUsage(accountId) {
    const now = Date.now();
    this.lastActivity.set(accountId, now);
   
    // עדכון מונים
    if (!this.accountUsage.has(accountId)) {
      this.accountUsage.set(accountId, { minute: 0, hour: 0, day: 0 });
    }
   
    const usage = this.accountUsage.get(accountId);
    usage.minute++;
    usage.hour++;
    usage.day++;
   
    // איפוס מונים בזמנים מתאימים
    this.scheduleReset(accountId);
  }
 
  // תזמון איפוס מונים
  scheduleReset(accountId) {
    // איפוס דקה
    setTimeout(() => {
      const usage = this.accountUsage.get(accountId);
      if (usage) usage.minute = Math.max(0, usage.minute - 1);
    }, 60000);
   
    // איפוס שעה
    setTimeout(() => {
      const usage = this.accountUsage.get(accountId);
      if (usage) usage.hour = Math.max(0, usage.hour - 1);
    }, 3600000);
   
    // איפוס יום
    setTimeout(() => {
      const usage = this.accountUsage.get(accountId);
      if (usage) usage.day = Math.max(0, usage.day - 1);
    }, 86400000);
  }
 
  // בחירה חכמה של החשבון הטוב ביותר
  selectBestAccount() {
    const availableAccounts = readyBots.filter(id => this.isAccountAvailable(id));
   
    if (availableAccounts.length === 0) {
      writeLog('❌ אין חשבונות זמינים כרגע', 'ERROR');
      return null;
    }
   
    const strategy = config.ANTI_BLOCK_SYSTEM?.LOAD_BALANCING || 'intelligent';
   
    switch (strategy) {
      case 'least_used':
        return this.getLeastUsedAccount(availableAccounts);
      case 'random':
        return availableAccounts[Math.floor(Math.random() * availableAccounts.length)];
      case 'round_robin':
        distributionIndex = (distributionIndex + 1) % availableAccounts.length;
        return availableAccounts[distributionIndex];
      case 'intelligent':
      default:
        return this.getIntelligentAccount(availableAccounts);
    }
  }
 
  // חשבון עם הכי פחות שימוש
  getLeastUsedAccount(accounts) {
    return accounts.reduce((best, current) => {
      const bestUsage = this.accountUsage.get(best)?.day || 0;
      const currentUsage = this.accountUsage.get(current)?.day || 0;
      return currentUsage < bestUsage ? current : best;
    });
  }
 
  // בחירה חכמה על בסיס מספר פרמטרים
  getIntelligentAccount(accounts) {
    const scores = accounts.map(accountId => {
      const usage = this.accountUsage.get(accountId) || { minute: 0, hour: 0, day: 0 };
      const lastUsed = this.lastActivity.get(accountId) || 0;
      const timeSinceLastUse = Date.now() - lastUsed;
      const stats = accountStats[accountId] || { successRate: 100, avgResponseTime: 1000 };
     
      // חישוב ציון על בסיס מספר גורמים
      let score = 100;
      score -= usage.minute * 10; // פחות נקודות ככל שנשלחו יותר הודעות בדקה
      score -= usage.hour * 2;    // פחות נקודות ככל שנשלחו יותר הודעות בשעה
      score -= usage.day * 0.5;   // פחות נקודות ככל שנשלחו יותר הודעות ביום
      score += Math.min(timeSinceLastUse / 60000, 20); // בונוס לזמן מאז שימוש אחרון
      score += (stats.successRate - 50) / 2; // בונוס לשיעור הצלחה גבוה
      score -= Math.max(stats.avgResponseTime - 1000, 0) / 100; // קנס לזמן תגובה איטי
     
      return { accountId, score };
    });
   
    const bestAccount = scores.reduce((best, current) =>
      current.score > best.score ? current : best
    );
   
    writeLog(`🧠 נבחר חשבון ${bestAccount.accountId} עם ציון ${Math.round(bestAccount.score)}`, 'DEBUG');
    return bestAccount.accountId;
  }
 
  // חישוב השהיה אדפטיבית
  calculateSmartDelay() {
    const antiBlock = config.ANTI_BLOCK_SYSTEM || {};
    let baseDelay = antiBlock.MIN_DELAY_BETWEEN_SENDS || 3000;
    const maxDelay = antiBlock.MAX_DELAY_BETWEEN_SENDS || 12000;
   
    if (antiBlock.ADAPTIVE_DELAYS) {
      // התאמת השהיה לפי עומס המערכת
      const systemLoad = readyBots.length / QR_ACCOUNTS.length;
      const loadMultiplier = 1 + (1 - systemLoad) * 0.5; // יותר השהיה אם פחות חשבונות זמינים
      baseDelay *= loadMultiplier;
    }
   
    if (antiBlock.RANDOMIZE_DELAYS) {
      // הוספת רנדומליות
      const randomFactor = 0.7 + Math.random() * 0.6; // בין 70% ל-130%
      baseDelay *= randomFactor;
    }
   
    return Math.min(Math.max(baseDelay, antiBlock.MIN_DELAY_BETWEEN_SENDS || 3000), maxDelay);
  }
}

const antiBlockManager = new AdvancedAntiBlockManager();

// מערכת לוגים מתקדמת
const logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function writeLog(text, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLevel = logLevels[config?.LOG_LEVEL] || 2;
 
  if (logLevels[level] > logLevel) return;
 
  const logEntry = `${timestamp} | [${level}] [MULTI-QR-ADV] [${SYSTEM_INFO.userLogin}@${SYSTEM_INFO.hostname}] ${text}\n`;
 
  // כתיבה לקובץ אם מופעל
  if (config?.SAVE_LOGS_TO_FILE) {
    const logFile = level === 'ERROR' ? 'logs/error.log' : 'logs/bot.log';
    try {
      fs.appendFileSync(path.join(__dirname, logFile), logEntry);
    } catch (err) {
      console.log(`⚠️ לא ניתן לכתוב ללוג: ${err.message}`);
    }
  }
 
  // הדפסה לקונסול
  const emoji = { ERROR: '❌', WARN: '⚠️', INFO: 'ℹ️', DEBUG: '🔍' }[level] || 'ℹ️';
  const timeStr = `${SYSTEM_INFO.currentDate} ${SYSTEM_INFO.currentTime} UTC / ${SYSTEM_INFO.israelTime} IL`;
  console.log(`${emoji} [${level}] [MULTI-QR] [${SYSTEM_INFO.userLogin}@${timeStr}] ${text}`);
}

// 🆕 מערכת סטטיסטיקות מתקדמת
const statsPath = path.join(__dirname, 'stats.json');
let globalStats = {};

// טעינת סטטיסטיקות
if (fs.existsSync(statsPath)) {
  try {
    globalStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    writeLog('📊 סטטיסטיקות נטענו בהצלחה', 'INFO');
  } catch {
    globalStats = {};
    writeLog('⚠️ שגיאה בטעינת סטטיסטיקות, מתחיל מחדש', 'WARN');
  }
}

let realTimeStats = {
  // נתונים כלליים
  startTime: Date.now(),
  totalMessages: 0,
  successfulDeliveries: 0,
  failedDeliveries: 0,
  duplicatesBlocked: 0,
 
  // פילוח לפי סוג
  whatsappGroupsSent: 0,
  whatsappChannelsSent: 0,
  telegramChannelsSent: 0,
  telegramGroupsSent: 0,
 
  // מדיה
  videosSent: 0,
  imagesSent: 0,
  audioSent: 0,
  documentsSent: 0,
 
  // חשבונות
  activeAccounts: 0,
  accountsHealth: {},
 
  // ביצועים
  averageDistributionTime: 0,
  lastActivity: null,
 
  // מערכת
  antiBlockActive: config.ANTI_BLOCK_SYSTEM?.ENABLED || false,
  version: SYSTEM_INFO.version
};

// עדכון סטטיסטיקות חשבון
function updateAccountStats(accountId, success, mediaType = null, responseTime = 0) {
  if (!accountStats[accountId]) {
    accountStats[accountId] = {
      totalSent: 0,
      successful: 0,
      failed: 0,
      successRate: 100,
      avgResponseTime: 1000,
      lastUsed: null,
      mediaStats: { video: 0, image: 0, audio: 0, document: 0 }
    };
  }
 
  const stats = accountStats[accountId];
  stats.totalSent++;
  stats.lastUsed = Date.now();
 
  if (success) {
    stats.successful++;
    realTimeStats.successfulDeliveries++;
  } else {
    stats.failed++;
    realTimeStats.failedDeliveries++;
  }
 
  // עדכון שיעור הצלחה
  stats.successRate = Math.round((stats.successful / stats.totalSent) * 100);
 
  // עדכון זמן תגובה ממוצע
  if (responseTime > 0) {
    stats.avgResponseTime = Math.round((stats.avgResponseTime + responseTime) / 2);
  }
 
  // עדכון סטטיסטיקת מדיה
  if (mediaType && stats.mediaStats[mediaType] !== undefined) {
    stats.mediaStats[mediaType]++;
    realTimeStats[`${mediaType}sSent`] = (realTimeStats[`${mediaType}sSent`] || 0) + 1;
  }
 
  antiBlockManager.recordUsage(accountId);
  realTimeStats.totalMessages++;
  realTimeStats.lastActivity = Date.now();
 
  // שמירת סטטיסטיקות
  if (config.AUTO_SAVE_CONFIG) {
    try {
      fs.writeFileSync(statsPath, JSON.stringify({ globalStats, realTimeStats, accountStats }, null, 2));
    } catch (err) {
      writeLog(`⚠️ שגיאה בשמירת סטטיסטיקות: ${err.message}`, 'WARN');
    }
  }
}

// 🆕 זיהוי ערוצים מתקדם ומתוקן
function isAdvancedChannel(chat) {
  // בדיקות מתקדמות לזיהוי כל סוגי הערוצים
  const channelIndicators = [
    chat.isBroadcast,                    // רשימות שידור קלסיות
    chat.isNewsletter,                   // ערוצי Newsletter חדשים
    chat.type === 'newsletter',          // סוג ערוץ Newsletter
    chat.type === 'broadcast',           // סוג ערוץ Broadcast
    chat.isChannel,                      // תכונת ערוץ כללית
    // בדיקות ID
    chat.id && chat.id._serialized && (
      chat.id._serialized.includes('@newsletter') ||
      chat.id._serialized.includes('@broadcast') ||
      chat.id._serialized.endsWith('@newsletter') ||
      chat.id._serialized.endsWith('@broadcast')
    ),
    // בדיקות שם וסוג
    chat.name && (
      chat.name.includes('ערוץ') ||
      chat.name.includes('עדכונים') ||
      chat.name.includes('חדשות')
    ),
    // בדיקות מתקדמות
    !chat.isGroup && chat.participants && chat.participants.length > 50,
    chat.groupMetadata && chat.groupMetadata.restrict,
    chat.groupMetadata && !chat.groupMetadata.announce
  ];
 
  const isChannel = channelIndicators.some(indicator => indicator === true);
 
  if (isChannel) {
    writeLog(`📢 זוהה ערוץ: ${chat.name} (${chat.id?._serialized})`, 'DEBUG');
  }
 
  return isChannel;
}

// בדיקה אם הבוט חבר בערוץ
async function isBotMemberOfChannel(session, channelId) {
  try {
    if (!bots[session] || !readyBots.includes(session)) {
      return false;
    }
   
    const chat = await bots[session].getChatById(channelId);
    if (!chat) return false;
   
    // בדיקה אם הבוט יכול לשלוח הודעות
    const contact = await bots[session].getContactById(bots[session].info.wid._serialized);
    if (!contact) return false;
   
    return true;
  } catch (err) {
    writeLog(`❌ שגיאה בבדיקת חברות בערוץ ${channelId}: ${err.message}`, 'ERROR');
    return false;
  }
}

// 🆕 QR Display מתקדם
function showAdvancedQRCode(accountId, qr) {
  const accountIndex = QR_ACCOUNTS.indexOf(accountId) + 1;
  const connectedCount = readyBots.length;
  const totalAccounts = QR_ACCOUNTS.length;
 
  console.log(`\n🔑 ═══════════════════════════════════════════════════════════`);
  console.log(`   📱 QR עבור חשבון: ${accountId} (${accountIndex}/${totalAccounts})`);
  console.log(`   🌐 מחוברים: ${connectedCount}/${totalAccounts} חשבונות`);
  console.log(`   🕐 זמן: ${SYSTEM_INFO.currentTime} UTC / ${SYSTEM_INFO.israelTime} IL`);
  console.log(`   🛡️ Anti-Block: ${config.ANTI_BLOCK_SYSTEM?.ENABLED ? 'פעיל' : 'כבוי'}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
 
  qrcode.generate(qr, { small: true });
 
  console.log(`\n📋 הוראות:`);
  console.log(`1. פתח WhatsApp במכשיר`);
  console.log(`2. לך להגדרות > מכשירים מקושרים`);
  console.log(`3. סרוק את ה-QR למעלה`);
  console.log(`4. חכה לאישור חיבור`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
 
  writeLog(`🔑 QR נוצר עבור חשבון ${accountId} (${accountIndex}/${totalAccounts})`, 'INFO');
}

// 🆕 אתחול בוט יחיד עם הגנות מתקדמות
async function initializeSingleBot(accountId) {
  return new Promise((resolve, reject) => {
    writeLog(`🚀 מתחיל אתחול חשבון ${accountId}`, 'INFO');
   
    const sessionPath = path.join(__dirname, 'sessions', accountId);
   
    try {
      // יצירת תיקיית session אם לא קיימת
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }
     
      const bot = new Client({
        authStrategy: new LocalAuth({
          clientId: accountId,
          dataPath: sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--memory-pressure-off',
            '--max-old-space-size=1024',
            '--aggressive-cache-discard',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',
            `--user-data-dir=${path.join(sessionPath, 'chrome-data')}`
          ],
          defaultViewport: { width: 1366, height: 768 },
          ignoreHTTPSErrors: true,
          timeout: config.ACCOUNT_SETTINGS?.QR_TIMEOUT || 120000
        },
        session: accountId
      });
     
      // Event: QR Code
      bot.on('qr', (qr) => {
        showAdvancedQRCode(accountId, qr);
        writeLog(`📱 QR מוכן לסריקה עבור ${accountId}`, 'INFO');
      });
     
      // Event: Authentication Success
      bot.on('authenticated', () => {
        writeLog(`🔐 חשבון ${accountId} אומת בהצלחה!`, 'INFO');
      });
     
      // Event: Ready
      bot.on('ready', async () => {
        if (!readyBots.includes(accountId)) {
          readyBots.push(accountId);
        }
       
        realTimeStats.activeAccounts = readyBots.length;
       
        // קבלת מידע על החשבון
        try {
          const info = bot.info;
          writeLog(`✅ חשבון ${accountId} מוכן! נתונים: ${info.pushname} (${info.wid.user})`, 'INFO');
         
          // בדיקת ערוצים זמינים
          const chats = await bot.getChats();
          const channels = chats.filter(chat => isAdvancedChannel(chat));
          const groups = chats.filter(chat => chat.isGroup && !isAdvancedChannel(chat));
         
          writeLog(`📊 חשבון ${accountId}: ${groups.length} קבוצות, ${channels.length} ערוצים`, 'INFO');
         
          // אתחול סטטיסטיקות חשבון
          if (!accountStats[accountId]) {
            accountStats[accountId] = {
              totalSent: 0,
              successful: 0,
              failed: 0,
              successRate: 100,
              avgResponseTime: 1000,
              lastUsed: null,
              mediaStats: { video: 0, image: 0, audio: 0, document: 0 },
              connectionTime: Date.now(),
              groups: groups.length,
              channels: channels.length
            };
          }
         
          resolve(bot);
         
        } catch (err) {
          writeLog(`⚠️ שגיאה בקבלת נתוני חשבון ${accountId}: ${err.message}`, 'WARN');
          resolve(bot);
        }
      });
     
      // Event: Authentication Failed
      bot.on('auth_failure', (msg) => {
        writeLog(`❌ כשל באימות חשבון ${accountId}: ${msg}`, 'ERROR');
        setTimeout(() => {
          if (config.ACCOUNT_SETTINGS?.AUTO_RECONNECT) {
            writeLog(`🔄 מנסה להתחבר מחדש לחשבון ${accountId}`, 'INFO');
            initializeSingleBot(accountId);
          }
        }, config.ACCOUNT_SETTINGS?.RECONNECT_DELAY || 30000);
        reject(new Error(`Auth failed for ${accountId}: ${msg}`));
      });
     
      // Event: Disconnected
      bot.on('disconnected', (reason) => {
        writeLog(`🔌 חשבון ${accountId} התנתק! סיבה: ${reason}`, 'WARN');
       
        // הסרה מרשימת החשבונות המוכנים
        const index = readyBots.indexOf(accountId);
        if (index > -1) {
          readyBots.splice(index, 1);
          realTimeStats.activeAccounts = readyBots.length;
        }
       
        // ניסיון התחברות מחדש
        if (config.ACCOUNT_SETTINGS?.AUTO_RECONNECT) {
          setTimeout(() => {
            writeLog(`🔄 מנסה להתחבר מחדש לחשבון ${accountId}`, 'INFO');
            initializeSingleBot(accountId);
          }, config.ACCOUNT_SETTINGS?.RECONNECT_DELAY || 30000);
        }
      });
     
      // Event: Message Create (כל ההודעות החדשות)
      bot.on('message_create', async (message) => {
        try {
          await handleAdvancedIncomingMessage(message, accountId);
        } catch (err) {
          writeLog(`❌ שגיאה בטיפול בהודעה דרך ${accountId}: ${err.message}`, 'ERROR');
        }
      });
     
      // Event: Message (רק הודעות נכנסות)
      bot.on('message', async (message) => {
        try {
          await handleAdvancedIncomingMessage(message, accountId);
        } catch (err) {
          writeLog(`❌ שגיאה בטיפול בהודעה נכנסת דרך ${accountId}: ${err.message}`, 'ERROR');
        }
      });
     
      // שמירת הבוט במערך
      bots[accountId] = bot;
     
      // אתחול הבוט
      bot.initialize().catch(err => {
        writeLog(`❌ שגיאה באתחול בוט ${accountId}: ${err.message}`, 'ERROR');
        reject(err);
      });
     
    } catch (err) {
      writeLog(`❌ שגיאה קריטית באתחול חשבון ${accountId}: ${err.message}`, 'ERROR');
      reject(err);
    }
  });
}

// 🆕 אתחול כל החשבונות במקביל
async function initializeAllBots() {
  writeLog(`🚀 מתחיל אתחול ${QR_ACCOUNTS.length} חשבונות במקביל`, 'INFO');
  writeLog(`📱 חשבונות: ${QR_ACCOUNTS.join(', ')}`, 'INFO');
 
  const initPromises = QR_ACCOUNTS.map(async (accountId, index) => {
    try {
      // השהיה קטנה בין אתחולים למניעת עומס
      await new Promise(resolve => setTimeout(resolve, index * 2000));
     
      writeLog(`⚡ מתחיל אתחול חשבון ${accountId} (${index + 1}/${QR_ACCOUNTS.length})`, 'INFO');
      return await initializeSingleBot(accountId);
    } catch (err) {
      writeLog(`❌ כשל באתחול חשבון ${accountId}: ${err.message}`, 'ERROR');
      return null;
    }
  });
 
  // המתנה לכל האתחולים
  const results = await Promise.allSettled(initPromises);
 
  let successCount = 0;
  let failedCount = 0;
 
  results.forEach((result, index) => {
    const accountId = QR_ACCOUNTS[index];
    if (result.status === 'fulfilled' && result.value) {
      successCount++;
      writeLog(`✅ חשבון ${accountId} הוכן בהצלחה`, 'INFO');
    } else {
      failedCount++;
      writeLog(`❌ חשבון ${accountId} נכשל באתחול`, 'ERROR');
    }
  });
 
  writeLog(`📊 סיכום אתחול: ${successCount} הצליחו, ${failedCount} נכשלו`, 'INFO');
  writeLog(`🎯 מערכת Multi-QR מוכנה עם ${readyBots.length} חשבונות פעילים!`, 'INFO');
 
  // התחלת מעקב בריאות חשבונות
  startHealthMonitoring();
}

// 🆕 מעקב בריאות חשבונות
function startHealthMonitoring() {
  const interval = config.ACCOUNT_SETTINGS?.HEALTH_CHECK_INTERVAL || 60000;
 
  setInterval(async () => {
    for (const accountId of QR_ACCOUNTS) {
      try {
        if (bots[accountId] && readyBots.includes(accountId)) {
          // בדיקה פשוטה - קבלת מידע על החשבון
          const info = await bots[accountId].getState();
         
          if (info !== 'CONNECTED') {
            writeLog(`⚠️ חשבון ${accountId} לא במצב מחובר: ${info}`, 'WARN');
           
            // הסרה מרשימת המוכנים
            const index = readyBots.indexOf(accountId);
            if (index > -1) {
              readyBots.splice(index, 1);
              realTimeStats.activeAccounts = readyBots.length;
            }
          }
        }
      } catch (err) {
        writeLog(`🏥 בדיקת בריאות נכשלה עבור ${accountId}: ${err.message}`, 'DEBUG');
      }
    }
   
    writeLog(`🏥 בדיקת בריאות: ${readyBots.length}/${QR_ACCOUNTS.length} חשבונות תקינים`, 'DEBUG');
  }, interval);
}

// 🆕 מערכת כפילויות מתקדמת
const duplicateCache = new Map();
const duplicateTimeWindow = 24 * 60 * 60 * 1000; // 24 שעות

function generateAdvancedHash(content, media = null) {
  let hashInput = content || '';
  
  if (media) {
    // עבור מדיה - שילוב של תוכן + גודל קובץ + סוג
    hashInput += media.mimetype || '';
    hashInput += (media.data ? media.data.length : 0).toString();
  }
  
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

function isDuplicate(content, media = null) {
  const hash = generateAdvancedHash(content, media);
  const now = Date.now();
  
  // בדיקה אם קיים
  if (duplicateCache.has(hash)) {
    const timestamp = duplicateCache.get(hash);
    if (now - timestamp < duplicateTimeWindow) {
      writeLog(`🔄 זוהתה כפילות: ${hash.substring(0, 8)}...`, 'DEBUG');
      realTimeStats.duplicatesBlocked++;
      return true;
    } else {
      // הודעה ישנה - ניתן לשלוח שוב
      duplicateCache.delete(hash);
    }
  }
  
  // שמירה במטמון
  duplicateCache.set(hash, now);
  
  // ניקוי מטמון מהודעות ישנות
  if (duplicateCache.size > 1000) {
    cleanDuplicateCache();
  }
  
  return false;
}

function cleanDuplicateCache() {
  const now = Date.now();
  for (const [hash, timestamp] of duplicateCache.entries()) {
    if (now - timestamp > duplicateTimeWindow) {
      duplicateCache.delete(hash);
    }
  }
  writeLog(`🧹 נוקה מטמון כפילויות: ${duplicateCache.size} רשומות נותרו`, 'DEBUG');
}

// 🆕 שליחה מתקדמת עם Anti-Block
async function sendAdvancedMessage(targetChat, content, mediaObj = null, accountId) {
  const startTime = Date.now();
  
  try {
    // השהיה חכמה
    const delay = antiBlockManager.calculateSmartDelay();
    await new Promise(resolve => setTimeout(resolve, delay));
    
    let result;
    if (mediaObj) {
      result = await targetChat.sendMessage(mediaObj, { caption: content });
    } else {
      result = await targetChat.sendMessage(content);
    }
    
    const responseTime = Date.now() - startTime;
    updateAccountStats(accountId, true, null, responseTime);
    
    writeLog(`✅ הודעה נשלחה בהצלחה דרך ${accountId} (${responseTime}ms)`, 'DEBUG');
    return { success: true, responseTime };
    
  } catch (err) {
    const responseTime = Date.now() - startTime;
    updateAccountStats(accountId, false, null, responseTime);
    
    writeLog(`❌ שגיאה בשליחה דרך ${accountId}: ${err.message}`, 'ERROR');
    return { success: false, error: err.message, responseTime };
  }
}

// 🆕 הפצה מתקדמת לקבוצות וערוצים
async function distributeAdvancedMessage(content, media = null) {
  writeLog(`🚀 מתחיל הפצה מתקדמת: ${readyBots.length} חשבונות זמינים`, 'INFO');
  
  const results = {
    groups: { success: 0, failed: 0, details: [] },
    channels: { success: 0, failed: 0, details: [] },
    totalStartTime: Date.now()
  };
  
  // הפצה לקבוצות
  for (const groupName of config.TARGET_GROUP_NAMES) {
    const accountId = antiBlockManager.selectBestAccount();
    if (!accountId) {
      writeLog('❌ אין חשבונות זמינים להפצה', 'ERROR');
      break;
    }
    
    try {
      const chats = await bots[accountId].getChats();
      const targetGroup = chats.find(c => c.isGroup && !isAdvancedChannel(c) && c.name === groupName);
      
      if (!targetGroup) {
        writeLog(`⚠️ קבוצה לא נמצאה: ${groupName}`, 'WARN');
        results.groups.failed++;
        results.groups.details.push({ name: groupName, status: 'not_found', account: accountId });
        continue;
      }
      
      const sendResult = await sendAdvancedMessage(targetGroup, content, media, accountId);
      
      if (sendResult.success) {
        results.groups.success++;
        results.groups.details.push({ 
          name: groupName, 
          status: 'sent', 
          account: accountId, 
          responseTime: sendResult.responseTime 
        });
      } else {
        results.groups.failed++;
        results.groups.details.push({ 
          name: groupName, 
          status: 'error', 
          account: accountId, 
          error: sendResult.error 
        });
      }
      
    } catch (err) {
      writeLog(`❌ שגיאה בהפצה לקבוצה ${groupName}: ${err.message}`, 'ERROR');
      results.groups.failed++;
      results.groups.details.push({ name: groupName, status: 'error', account: accountId, error: err.message });
    }
  }
  
  // הפצה לערוצים אם מופעלת
  if (config.SEND_TO_CHANNELS) {
    for (const channelName of config.TARGET_CHANNELS) {
      const accountId = antiBlockManager.selectBestAccount();
      if (!accountId) break;
      
      try {
        const chats = await bots[accountId].getChats();
        const targetChannel = chats.find(c => isAdvancedChannel(c) && c.name === channelName);
        
        if (!targetChannel) {
          writeLog(`⚠️ ערוץ לא נמצא: ${channelName}`, 'WARN');
          results.channels.failed++;
          results.channels.details.push({ name: channelName, status: 'not_found', account: accountId });
          continue;
        }
        
        const sendResult = await sendAdvancedMessage(targetChannel, content, media, accountId);
        
        if (sendResult.success) {
          results.channels.success++;
          results.channels.details.push({ 
            name: channelName, 
            status: 'sent', 
            account: accountId, 
            responseTime: sendResult.responseTime 
          });
        } else {
          results.channels.failed++;
          results.channels.details.push({ 
            name: channelName, 
            status: 'error', 
            account: accountId, 
            error: sendResult.error 
          });
        }
        
      } catch (err) {
        writeLog(`❌ שגיאה בהפצה לערוץ ${channelName}: ${err.message}`, 'ERROR');
        results.channels.failed++;
        results.channels.details.push({ name: channelName, status: 'error', account: accountId, error: err.message });
      }
    }
  }
  
  const totalTime = Date.now() - results.totalStartTime;
  realTimeStats.averageDistributionTime = Math.round((realTimeStats.averageDistributionTime + totalTime) / 2);
  
  writeLog(`📊 הפצה הושלמה (${totalTime}ms): קבוצות ${results.groups.success}/${results.groups.success + results.groups.failed}, ערוצים ${results.channels.success}/${results.channels.success + results.channels.failed}`, 'INFO');
  
  return results;
}

// 🆕 טיפול מתקדם בהודעות נכנסות
async function handleAdvancedIncomingMessage(message, receivingAccountId) {
  try {
    const chat = await message.getChat();
    const senderId = message.from.split('@')[0];
    const senderPhone = senderId.startsWith('972') ? '0' + senderId.slice(3) : senderId;
    
    // בדיקת הרשאות מתקדמת
    const isAuthorized = config.AUTHORIZED_SENDERS.includes(senderPhone) || 
                        config.SUPER_ADMINS.includes(senderPhone) ||
                        (config.ALLOW_ALL_FROM_SHIGUR && chat.name === config.SHIGUR_GROUP);
    
    if (!isAuthorized) {
      writeLog(`🚫 הודעה לא מורשית מ: ${senderPhone}`, 'DEBUG');
      return;
    }
    
    // בדיקת קבוצת מקור
    if (chat.name !== config.SHIGUR_GROUP && chat.name !== config.MANAGEMENT_GROUP) {
      writeLog(`🚫 הודעה מקבוצה לא מורשית: ${chat.name}`, 'DEBUG');
      return;
    }
    
    // טיפול בפקודות ניהול (מקבוצת ניהול)
    if (chat.name === config.MANAGEMENT_GROUP) {
      await handleManagementCommands(message, senderPhone);
      return;
    }
    
    // טיפול בהודעות רגילות (מקבוצת שיגור)
    if (chat.name === config.SHIGUR_GROUP) {
      await handleRegularMessage(message, senderPhone, receivingAccountId);
      return;
    }
    
  } catch (err) {
    writeLog(`❌ שגיאה בטיפול בהודעה נכנסת: ${err.message}`, 'ERROR');
  }
}

// 🆕 טיפול בפקודות ניהול
async function handleManagementCommands(message, senderPhone) {
  const text = message.body.trim();
  
  // בדיקת הרשאות מנהלים
  if (!config.SUPER_ADMINS.includes(senderPhone) && !config.REGULAR_ADMINS.includes(senderPhone)) {
    await message.reply('❌ אין לך הרשאה לפקודות ניהול');
    return;
  }
  
  // פקודות סטטיסטיקה
  if (text === '/stats' || text === 'סטטיסטיקה') {
    const statsMessage = generateStatsReport();
    await message.reply(statsMessage);
    return;
  }
  
  // פקודות בריאות מערכת
  if (text === '/health' || text === 'בריאות') {
    const healthMessage = generateHealthReport();
    await message.reply(healthMessage);
    return;
  }
  
  // פקודות קונפיג
  if (text.startsWith('/config') || text.startsWith('קונפיג')) {
    await handleConfigCommands(message, text, senderPhone);
    return;
  }
  
  // פקודות חשבונות
  if (text.startsWith('/accounts') || text.startsWith('חשבונות')) {
    await handleAccountCommands(message, text, senderPhone);
    return;
  }
}

// 🆕 טיפול בהודעות רגילות להפצה
async function handleRegularMessage(message, senderPhone, receivingAccountId) {
  try {
    let content = message.body;
    let media = null;
    
    // טיפול במדיה
    if (message.hasMedia) {
      media = await message.downloadMedia();
      if (!media) {
        writeLog('❌ כשל בהורדת מדיה', 'ERROR');
        await message.react('❌');
        return;
      }
    }
    
    // בדיקת כפילויות
    if (isDuplicate(content, media)) {
      writeLog('🔄 הודעה כפולה - מתעלמים', 'DEBUG');
      await message.react('🔄');
      return;
    }
    
    // הוספת חתימה
    if (config.SIGNATURE && content) {
      content += config.SIGNATURE;
    }
    
    writeLog(`📤 מתחיל הפצה מ-${senderPhone} דרך ${receivingAccountId}`, 'INFO');
    
    // הפצה
    const results = await distributeAdvancedMessage(content, media);
    
    // תגובה למשלח
    const totalSuccess = results.groups.success + results.channels.success;
    const totalFailed = results.groups.failed + results.channels.failed;
    
    if (totalSuccess > 0 && totalFailed === 0) {
      await message.react('✅');
    } else if (totalSuccess > 0 && totalFailed > 0) {
      await message.react('⚠️');
    } else {
      await message.react('❌');
    }
    
    // דיווח מפורט אם מופעל
    if (config.DETAILED_STATISTICS) {
      const reportMessage = `📊 סיכום הפצה:\n✅ הצליח: ${totalSuccess}\n❌ נכשל: ${totalFailed}\n⏱️ זמן: ${results.totalStartTime}ms`;
      await message.reply(reportMessage);
    }
    
  } catch (err) {
    writeLog(`❌ שגיאה בטיפול בהודעה רגילה: ${err.message}`, 'ERROR');
    await message.react('❌');
  }
}

// 🆕 יצירת דוח סטטיסטיקות
function generateStatsReport() {
  const uptime = Date.now() - realTimeStats.startTime;
  const uptimeStr = Math.round(uptime / 1000 / 60) + ' דקות';
  
  let report = `📊 *דוח סטטיסטיקות מערכת*\n\n`;
  report += `🕐 זמן פעילות: ${uptimeStr}\n`;
  report += `📱 חשבונות פעילים: ${readyBots.length}/${QR_ACCOUNTS.length}\n`;
  report += `📈 הודעות שנשלחו: ${realTimeStats.totalMessages}\n`;
  report += `✅ הצליחו: ${realTimeStats.successfulDeliveries}\n`;
  report += `❌ נכשלו: ${realTimeStats.failedDeliveries}\n`;
  report += `🔄 כפילויות חסומות: ${realTimeStats.duplicatesBlocked}\n`;
  report += `⚡ זמן הפצה ממוצע: ${realTimeStats.averageDistributionTime}ms\n\n`;
  
  report += `📊 *פילוח לפי חשבון:*\n`;
  for (const [accountId, stats] of Object.entries(accountStats)) {
    report += `• ${accountId}: ${stats.successRate}% הצלחה (${stats.totalSent} סה"כ)\n`;
  }
  
  return report;
}

// 🆕 יצירת דוח בריאות מערכת
function generateHealthReport() {
  let report = `🏥 *דוח בריאות מערכת*\n\n`;
  
  report += `🌐 *חשבונות (${readyBots.length}/${QR_ACCOUNTS.length}):*\n`;
  for (const accountId of QR_ACCOUNTS) {
    const isReady = readyBots.includes(accountId);
    const stats = accountStats[accountId];
    const emoji = isReady ? '🟢' : '🔴';
    
    report += `${emoji} ${accountId}`;
    if (stats) {
      report += ` - ${stats.successRate}% הצלחה`;
    }
    report += '\n';
  }
  
  report += `\n🛡️ Anti-Block: ${config.ANTI_BLOCK_SYSTEM?.ENABLED ? '🟢 פעיל' : '🔴 כבוי'}\n`;
  report += `📊 מטמון כפילויות: ${duplicateCache.size} רשומות\n`;
  report += `🔧 גרסה: ${SYSTEM_INFO.version}\n`;
  
  return report;
}

// 🆕 טיפול בפקודות קונפיג
async function handleConfigCommands(message, text, senderPhone) {
  if (!config.SUPER_ADMINS.includes(senderPhone)) {
    await message.reply('❌ רק סופר אדמינים יכולים לערוך קונפיג');
    return;
  }
  
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    await message.reply('📝 פקודות קונפיג זמינות:\n/config show - הצג קונפיג\n/config reload - טען מחדש\n/config save - שמור');
    return;
  }
  
  const command = parts[1];
  
  switch (command) {
    case 'show':
      const configStr = JSON.stringify(config, null, 2);
      await message.reply(`⚙️ קונפיג נוכחי:\n\`\`\`\n${configStr.substring(0, 1000)}...\n\`\`\``);
      break;
      
    case 'reload':
      try {
        config = loadConfig();
        await message.reply('✅ קונפיג נטען מחדש בהצלחה');
      } catch (err) {
        await message.reply(`❌ שגיאה בטעינת קונפיג: ${err.message}`);
      }
      break;
      
    case 'save':
      if (saveConfig(config)) {
        await message.reply('✅ קונפיג נשמר בהצלחה');
      } else {
        await message.reply('❌ שגיאה בשמירת קונפיג');
      }
      break;
      
    default:
      await message.reply('❌ פקודה לא מוכרת');
  }
}

// 🆕 טיפול בפקודות חשבונות
async function handleAccountCommands(message, text, senderPhone) {
  if (!config.SUPER_ADMINS.includes(senderPhone)) {
    await message.reply('❌ רק סופר אדמינים יכולים לנהל חשבונות');
    return;
  }
  
  const parts = text.split(' ');
  
  if (parts.length < 2) {
    await message.reply('📱 פקודות חשבונות זמינות:\n/accounts list - רשימת חשבונות\n/accounts restart <id> - הפעל מחדש\n/accounts add <id> - הוסף חשבון');
    return;
  }
  
  const command = parts[1];
  
  switch (command) {
    case 'list':
      let accountsList = '📱 *רשימת חשבונות:*\n\n';
      for (const accountId of QR_ACCOUNTS) {
        const isReady = readyBots.includes(accountId);
        const stats = accountStats[accountId];
        const emoji = isReady ? '🟢' : '🔴';
        
        accountsList += `${emoji} ${accountId}`;
        if (stats) {
          accountsList += ` (${stats.totalSent} הודעות, ${stats.successRate}% הצלחה)`;
        }
        accountsList += '\n';
      }
      await message.reply(accountsList);
      break;
      
    case 'restart':
      if (parts.length < 3) {
        await message.reply('❌ נדרש ID חשבון');
        return;
      }
      
      const accountToRestart = parts[2];
      if (!QR_ACCOUNTS.includes(accountToRestart)) {
        await message.reply('❌ חשבון לא נמצא');
        return;
      }
      
      try {
        if (bots[accountToRestart]) {
          await bots[accountToRestart].destroy();
        }
        await initializeSingleBot(accountToRestart);
        await message.reply(`✅ חשבון ${accountToRestart} הופעל מחדש`);
      } catch (err) {
        await message.reply(`❌ שגיאה בהפעלה מחדש: ${err.message}`);
      }
      break;
      
    case 'add':
      if (parts.length < 3) {
        await message.reply('❌ נדרש ID חשבון חדש');
        return;
      }
      
      const newAccountId = parts[2];
      if (QR_ACCOUNTS.includes(newAccountId)) {
        await message.reply('❌ החשבון כבר קיים');
        return;
      }
      
      config.QR_ACCOUNTS.push(newAccountId);
      if (saveConfig(config)) {
        try {
          await initializeSingleBot(newAccountId);
          await message.reply(`✅ חשבון ${newAccountId} נוסף והופעל`);
        } catch (err) {
          await message.reply(`⚠️ חשבון נוסף אך נכשל באתחול: ${err.message}`);
        }
      } else {
        await message.reply('❌ שגיאה בשמירת קונפיג');
      }
      break;
      
    default:
      await message.reply('❌ פקודה לא מוכרת');
  }
}

// הפעלת המערכת
async function startAdvancedSystem() {
  writeLog(`🚀 מפעיל מערכת Multi-QR מתקדמת ${SYSTEM_INFO.version}`, 'INFO');
  writeLog(`💻 מערכת: ${SYSTEM_INFO.platform} | Node: ${SYSTEM_INFO.nodeVersion}`, 'INFO');
  writeLog(`🕐 זמן: ${SYSTEM_INFO.currentTime} UTC / ${SYSTEM_INFO.israelTime} IL`, 'INFO');
  
  try {
    await initializeAllBots();
    writeLog('🎯 מערכת הופעלה בהצלחה!', 'INFO');
  } catch (err) {
    writeLog(`❌ שגיאה קריטית בהפעלת מערכת: ${err.message}`, 'ERROR');
    process.exit(1);
  }
}

// טיפול בסגירה חלקה
process.on('SIGINT', () => {
  writeLog('🛑 מקבל אות סגירה, סוגר בטוח...', 'INFO');
  process.exit(0);
});

process.on('SIGTERM', () => {
  writeLog('🛑 מקבל אות סגירה, סוגר בטוח...', 'INFO');
  process.exit(0);
});

// הפעלת המערכת
startAdvancedSystem();