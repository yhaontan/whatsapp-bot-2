#!/bin/bash

# WhatsApp Bot Advanced Startup Script
# בוט וואטסאפ מתקדם - סקריפט הפעלה

echo "🚀 מפעיל בוט וואטסאפ מתקדם Multi-QR v3.0"
echo "==========================================="

# בדיקת Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js לא מותקן. אנא התקן Node.js גרסה 16 או יותר גבוהה."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ נדרש Node.js גרסה 16 או יותר גבוהה. גרסה נוכחית: $(node -v)"
    exit 1
fi

echo "✅ Node.js גרסה: $(node -v)"

# בדיקת dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 מתקין dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ התקנת dependencies נכשלה"
        exit 1
    fi
fi

# בדיקת קונפיגורציה
if [ ! -f "config.json" ]; then
    echo "⚠️ קובץ config.json לא נמצא. הבוט יצור קונפיג ברירת מחדל."
fi

# רצה בדיקות מהירות
echo "🧪 מריץ בדיקות מהירות..."
node test_advanced_features.js
if [ $? -ne 0 ]; then
    echo "❌ בדיקות נכשלו"
    exit 1
fi

echo ""
echo "🎯 הכל מוכן! מפעיל את הבוט..."
echo "📱 סרוק את קודי ה-QR שיוצגו על המסך"
echo "🛑 לעצירה: Ctrl+C"
echo ""

# הפעלת הבוט
node index.js