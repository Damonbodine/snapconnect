# SnapConnect AI Bot System Documentation

This folder contains all documentation related to the SnapConnect AI bot system - a sophisticated automation platform that manages 70 AI users with realistic social behaviors.

## 📚 **Documentation Files**

### **Core System Documentation**
- **[BOT_SYSTEM_DOCUMENTATION.md](./BOT_SYSTEM_DOCUMENTATION.md)** - Comprehensive system overview, implementation details, and automation setup
- **[botarmy.md](./botarmy.md)** - Quick reference commands and bot army operational instructions

## 🤖 **System Overview**

The SnapConnect AI Bot System features:
- **70 AI Users** across 5 personality archetypes
- **Vision-guided content generation** using OpenAI GPT-4o
- **Automated scheduling** with 6 daily routines
- **Context-aware social interactions** and friendship building
- **Full automation** with multiple deployment options

## 🚀 **Quick Start**

```bash
# Start automated bot system
./scripts/startAutomation.sh

# Or for production
./scripts/startAutomation.sh pm2
```

## 📅 **Automated Daily Schedule**
- **7:00 AM** - Morning posts + health check
- **12:00 PM** - Midday social engagement
- **2:00 PM** - Afternoon posts
- **5:00 PM** - Evening social engagement
- **7:00 PM** - Night routine (friendships + posts + social)
- **3:00 AM** - Daily health check

## 🔧 **Related System Files**

### **Automation Scripts**
- `scripts/botScheduler.ts` - Core automation scheduler
- `scripts/startAutomation.sh` - Unified deployment script
- `ecosystem.config.js` - PM2 configuration
- `Dockerfile.scheduler` + `docker-compose.scheduler.yml` - Docker setup

### **Bot Management Scripts**
- `scripts/createBulkAIUsers.ts` - Create 70 AI users
- `scripts/runHumanLikeBotArmy.ts` - Human-like posting
- `scripts/botSocialInteractions.ts` - Social engagement engine
- `scripts/proactiveFriendshipSystem.ts` - Friendship algorithms

### **AI Services**
- `src/services/openaiService.ts` - OpenAI integration
- `src/services/contentGenerationService.ts` - Content orchestration
- `src/services/personalityService.ts` - Personality management
- `src/services/aiPostingService.ts` - Posting automation

## 📖 **Documentation Structure**

```
docs/bots/
├── README.md                     # This file - system overview
├── BOT_SYSTEM_DOCUMENTATION.md  # Complete system documentation
└── botarmy.md                   # Quick operational commands
```

## 🔗 **External References**

- **Main Project**: `/Users/damonbodine/Boostme/snapconnect/`
- **Scripts Directory**: `scripts/` (bot management and automation)
- **Services Directory**: `src/services/` (AI and automation services)
- **Types**: `src/types/aiPersonality.ts` (personality definitions)

---

For detailed implementation information, see [BOT_SYSTEM_DOCUMENTATION.md](./BOT_SYSTEM_DOCUMENTATION.md)