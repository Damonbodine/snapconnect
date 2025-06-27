# Complete Expo Go & React Native Development Guide

*Comprehensive documentation for Claude Code agents building React Native applications with Expo*

## Table of Contents

1. [Core Concepts & Architecture](#core-concepts--architecture)
2. [Project Setup & Initialization](#project-setup--initialization)
3. [Expo Go vs Development Builds](#expo-go-vs-development-builds)
4. [Configuration Files](#configuration-files)
5. [Development Workflow](#development-workflow)
6. [Common Commands Reference](#common-commands-reference)
7. [Troubleshooting & Common Errors](#troubleshooting--common-errors)
8. [Best Practices](#best-practices)
9. [Limitations & Constraints](#limitations--constraints)
10. [Advanced Configuration](#advanced-configuration)
11. [Quick Reference](#quick-reference)

---

## Core Concepts & Architecture

### What is Expo?

Expo is an open-source platform for making universal native apps for Android, iOS, and the web with JavaScript and React. It provides:

- **Expo SDK**: A set of tools and libraries for React Native
- **Expo Go**: A client app for testing during development
- **EAS (Expo Application Services)**: Build, submit, and update services
- **Expo Router**: File-based routing system
- **Development Builds**: Custom versions of Expo Go with your native code

### React Native App Architecture

A React Native app consists of two main parts:

1. **Native App Bundle** (Immutable once installed)
   - Contains native code, modules, and configurations
   - Includes app metadata (name, icon, splash screen)
   - Cannot be modified without rebuilding and reinstalling

2. **JavaScript Bundle** (Mutable during development)
   - Contains UI code and business logic
   - Can be hot-reloaded during development
   - Updated via Metro bundler (`npx expo start`)

### Key Concepts

- **Metro**: JavaScript bundler for React Native
- **Config Plugins**: Extend app configuration for native features
- **Prebuild**: Generates native code from Expo configuration
- **EAS Build**: Cloud build service for creating app binaries
- **Over-the-Air (OTA) Updates**: Update JS without app store releases

---

## Project Setup & Initialization

### Creating a New Project

```bash
# Create new Expo project
npx create-expo-app@latest MyApp

# Navigate to project
cd MyApp

# Start development server
npx expo start
```

### Project Structure

```
MyApp/
├── app/                    # App Router files (screens/routes)
│   ├── index.tsx          # Main entry point
│   └── _layout.tsx        # Root layout
├── assets/                # Static assets (images, fonts)
│   ├── images/
│   └── fonts/
├── components/            # Reusable components
├── constants/             # App constants
├── hooks/                 # Custom hooks
├── app.json              # Expo configuration
├── app.config.js         # Dynamic configuration (optional)
├── eas.json              # EAS Build/Submit configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

### Environment Setup

**Requirements:**
- Node.js (latest LTS version recommended)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI: `npm install -g eas-cli`

**Mobile Testing:**
- **iOS**: Expo Go app from App Store + iOS Simulator (Xcode required)
- **Android**: Expo Go app from Play Store + Android emulator
- **Web**: Any modern browser

---

## Expo Go vs Development Builds

### Expo Go (Sandbox Environment)

**Use Cases:**
- Learning React Native
- Prototyping and experimentation
- Testing apps that only use Expo SDK modules
- Quick demos and tutorials

**Limitations:**
- Cannot use libraries with custom native code
- Limited to modules included in Expo SDK
- Cannot modify native configuration
- Not suitable for production apps with complex requirements

**How to Use:**
```bash
npx expo start
# Scan QR code with Expo Go app
```

### Development Builds (Recommended for Production)

**Use Cases:**
- Production applications
- Apps requiring custom native modules
- Apps needing specific native configurations
- Integration with third-party SDKs

**Advantages:**
- Full control over native code
- Support for any React Native library
- Custom native modules and config plugins
- Closer to final production build

**How to Create:**
```bash
# Configure EAS Build
eas build:configure

# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

### When to Switch from Expo Go to Development Builds

Switch when you need:
- Custom native modules (Firebase, authentication, etc.)
- Specific native configurations
- Third-party libraries with native code
- Custom app icons, splash screens, or metadata
- Push notifications with custom setup
- Deep linking with custom schemes

---

## Configuration Files

### app.json / app.config.js

Primary configuration file for your Expo app.

**app.json (Static Configuration):**
```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.yourcompany.yourapp",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [],
    "extra": {
      "apiUrl": "https://api.example.com"
    }
  }
}
```

**app.config.js (Dynamic Configuration):**
```javascript
export default ({ config }) => {
  return {
    ...config,
    name: process.env.NODE_ENV === 'production' ? 'My App' : 'My App (Dev)',
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      environment: process.env.NODE_ENV || 'development',
    },
    plugins: [
      // Add plugins based on environment
      ...(process.env.NODE_ENV === 'production' ? ['sentry-expo'] : []),
    ],
  };
};
```

**Key Configuration Options:**

- **name**: App display name
- **slug**: URL-friendly identifier
- **version**: App version (semver)
- **orientation**: "portrait", "landscape", or "default"
- **icon**: App icon (1024x1024 PNG)
- **splash**: Splash screen configuration
- **scheme**: Deep linking URL scheme
- **plugins**: Config plugins for native features
- **extra**: Custom configuration accessible at runtime

### eas.json

Configuration for EAS Build and Submit services.

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./secrets/api-key.json",
        "track": "internal"
      },
      "ios": {
        "ascAppId": "1234567890"
      }
    }
  }
}
```

**Build Profiles:**
- **development**: For development builds with dev client
- **preview**: For internal testing (APK/IPA)
- **production**: For app store submissions

---

## Development Workflow

### Standard Development Flow

1. **Start Development Server:**
   ```bash
   npx expo start
   # Options:
   # --clear : Clear cache
   # --web : Start web version
   # --ios : Start iOS simulator
   # --android : Start Android emulator
   ```

2. **Test on Device:**
   - Scan QR code with Expo Go (for Expo Go projects)
   - Install development build (for custom projects)

3. **Make Changes:**
   - Edit JavaScript/TypeScript files
   - Changes reload automatically (Fast Refresh)

4. **Build for Production:**
   ```bash
   # Build for app stores
   eas build --profile production --platform all
   
   # Or locally (requires native tools)
   npx expo run:ios
   npx expo run:android
   ```

### File-Based Routing (Expo Router)

Expo Router provides file-based routing similar to Next.js:

```
app/
├── _layout.tsx          # Root layout
├── index.tsx           # Home screen (/)
├── about.tsx           # About screen (/about)
├── (tabs)/             # Tab group
│   ├── _layout.tsx     # Tab layout
│   ├── home.tsx        # /home
│   └── profile.tsx     # /profile
└── [id].tsx           # Dynamic route (/123)
```

**Basic Layout Example:**
```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
```

---

## Common Commands Reference

### Expo CLI Commands

```bash
# Project Management
npx create-expo-app MyApp          # Create new project
npx expo start                     # Start development server
npx expo start --clear             # Start with cleared cache
npx expo start --web               # Start web version
npx expo start --ios               # Start iOS simulator
npx expo start --android           # Start Android emulator

# Project Information
npx expo config                    # Show resolved configuration
npx expo config --type public      # Show public configuration
npx expo doctor                    # Check project health
npx expo whoami                    # Show logged-in user

# Building and Running
npx expo run:ios                   # Build and run on iOS
npx expo run:android               # Build and run on Android
npx expo export                    # Export for production

# Installation and Updates
npx expo install package-name      # Install compatible packages
npx expo install --fix             # Fix package versions
```

### EAS CLI Commands

```bash
# Authentication
eas login                          # Log in to Expo account
eas whoami                         # Show current user
eas logout                         # Log out

# Build Configuration
eas build:configure                # Configure EAS Build
eas build:list                     # List previous builds
eas build:cancel                   # Cancel running builds

# Building
eas build --platform ios           # Build for iOS
eas build --platform android       # Build for Android
eas build --platform all           # Build for both platforms
eas build --profile development    # Build with specific profile
eas build --clear-cache            # Build with cleared cache

# Submission
eas submit --platform ios          # Submit to App Store
eas submit --platform android      # Submit to Google Play

# Updates
eas update                         # Publish over-the-air update
eas update --branch main           # Update specific branch
```

---

## Troubleshooting & Common Errors

### Metro Bundler Issues

**Error: Metro encountered an error**
```bash
# Solutions:
npx expo start --clear             # Clear Metro cache
rm -rf node_modules && npm install # Reinstall dependencies
watchman watch-del-all             # Clear Watchman cache (macOS/Linux)
```

**Error: Task :app:bundleReleaseJsAndAssets FAILED**
```bash
# Test bundle locally:
npx expo export
# Fix any syntax errors, then retry build
```

### React Native Version Mismatch

**Error: "React Native version mismatch"**
```bash
# Solutions:
rm -rf node_modules && npm cache clean --force && npm install
npx expo start --clear
# Check app.json sdkVersion matches package.json expo version
```

### Network and Connection Issues

**Error: "Something went wrong" / Connection timeout**

Common causes and solutions:
- **Firewall/Proxy**: Check network settings, disable VPN
- **Wrong Network**: Ensure device and computer on same network
- **Port Issues**: Try different port with `npx expo start --port 19001`
- **Clear State**: `rm -rf .expo` to clear local state

### Build Errors

**Gradle Build Errors (Android):**
```bash
# Common solutions:
cd android && ./gradlew clean      # Clean Android build
rm -rf android/build               # Remove build artifacts
npx expo run:android --clear       # Clear cache and rebuild
```

**Xcode Build Errors (iOS):**
```bash
# Common solutions:
cd ios && xcodebuild clean         # Clean iOS build
rm -rf ios/build                   # Remove build artifacts
npx expo run:ios --clear           # Clear cache and rebuild
```

### Common Configuration Issues

**Application Not Registered Error:**
- Ensure `registerRootComponent` is called in entry file
- Check that the correct component is being registered

**Config Plugin Errors:**
- Verify plugin installation: `npm list <plugin-name>`
- Check plugin configuration in app.json/app.config.js
- Run `npx expo prebuild --clean` to regenerate native code

**SDK Version Issues:**
- Remove `sdkVersion` from app.json (auto-detected)
- Use `npx expo install` for package compatibility
- Run `npx expo doctor` to check version compatibility

### Development Build Issues

**Build Fails in EAS:**
1. Check build logs for specific errors
2. Verify all dependencies are compatible
3. Test build locally first: `npx expo run:ios` / `npx expo run:android`
4. Clear EAS cache: `eas build --clear-cache`

**Runtime Crashes:**
1. Check device logs (Xcode Console / Android Studio Logcat)
2. Test in development mode first
3. Check for missing native dependencies
4. Verify config plugin configurations

---

## Best Practices

### Project Structure

**Organize by Feature:**
```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── hooks/              # Custom hooks
├── services/           # API calls, utilities
├── context/            # React context providers
├── types/              # TypeScript type definitions
└── constants/          # App constants
```

### Configuration Management

**Environment Variables:**
```javascript
// app.config.js
export default {
  expo: {
    extra: {
      apiUrl: process.env.API_URL,
      environment: process.env.NODE_ENV,
    },
  },
};

// Access in app:
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

**Multiple Environments:**
```bash
# Use different configurations per environment
NODE_ENV=development npx expo start
NODE_ENV=staging eas build --profile staging
NODE_ENV=production eas build --profile production
```

### Performance Optimization

**Image Optimization:**
- Use appropriate image formats (WebP for Android, optimized PNG/JPEG)
- Implement lazy loading for lists
- Use `expo-image` for better performance

**Bundle Size:**
- Use `npx expo export` to analyze bundle size
- Implement code splitting where appropriate
- Remove unused dependencies

**Memory Management:**
- Clean up subscriptions and listeners
- Use `useMemo` and `useCallback` appropriately
- Monitor memory usage in development builds

### Code Quality

**TypeScript Configuration:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**ESLint Configuration:**
```json
{
  "extends": ["expo", "@react-native-community"],
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### Testing Strategy

**Unit Testing:**
```bash
npm install --save-dev jest @testing-library/react-native
```

**E2E Testing:**
- Use Detox for React Native apps
- Test critical user flows
- Automate testing in CI/CD pipeline

---

## Limitations & Constraints

### Expo Go Limitations

**Cannot Use:**
- Libraries with custom native code (Firebase, etc.)
- Modules not included in Expo SDK
- Custom native modules or config plugins
- Specific native configurations

**Supported Libraries:**
- All Expo SDK modules
- Pure JavaScript libraries
- Libraries without native dependencies

### Platform-Specific Considerations

**iOS Specific:**
- Requires macOS for local builds
- App Store review process
- Code signing requirements
- Device testing requires Apple Developer account

**Android Specific:**
- Different behavior for shadows (use `elevation` instead of `shadowColor`)
- Permission handling differences
- APK vs AAB bundle formats
- Google Play Console requirements

**Web Specific:**
- Not all React Native components work on web
- Different touch/hover interactions
- Browser compatibility considerations

### Performance Constraints

**Bundle Size Limits:**
- Keep JavaScript bundle under 50MB for optimal performance
- Use dynamic imports for large features
- Optimize images and assets

**Device Compatibility:**
- Test on various screen sizes and densities
- Consider older device performance
- Memory usage on low-end devices

---

## Advanced Configuration

### Custom Native Modules

**Local Expo Module:**
```bash
npx create-expo-module --local my-module
```

**Module Structure:**
```
modules/
└── my-module/
    ├── android/         # Android native code
    ├── ios/            # iOS native code
    ├── src/            # JavaScript/TypeScript
    └── expo-module.config.json
```

### Config Plugins

**Custom Config Plugin:**
```javascript
// plugins/my-plugin.js
module.exports = function withMyPlugin(config, props) {
  // Modify native configuration
  return config;
};

// app.config.js
module.exports = {
  plugins: [
    ['./plugins/my-plugin', { option: 'value' }]
  ],
};
```

### Custom Build Configurations

**Multiple App Variants:**
```json
{
  "build": {
    "development": {
      "env": { "APP_VARIANT": "dev" }
    },
    "staging": {
      "env": { "APP_VARIANT": "staging" }
    },
    "production": {
      "env": { "APP_VARIANT": "production" }
    }
  }
}
```

### Advanced EAS Configuration

**Custom Build Scripts:**
```json
{
  "build": {
    "production": {
      "env": {
        "NODE_ENV": "production"
      },
      "prebuildCommand": "npm run setup:production",
      "postInstall": "npm run post:install"
    }
  }
}
```

---

## Quick Reference

### Essential File Extensions
- `.tsx` - TypeScript React components
- `.ts` - TypeScript files
- `.js` - JavaScript files
- `.json` - Configuration files

### Key Dependencies
```json
{
  "expo": "~50.0.0",
  "react": "18.2.0",
  "react-native": "0.73.0",
  "expo-router": "~3.4.0"
}
```

### Important Directories
- `app/` - Expo Router screens and layouts
- `assets/` - Static assets (images, fonts)
- `components/` - Reusable components
- `android/` - Android native code (after prebuild)
- `ios/` - iOS native code (after prebuild)

### Debug Tools
- **React Native Debugger**: Standalone debugging tool
- **Flipper**: Mobile app debugger
- **Expo Dev Tools**: Built-in debugging interface
- **Chrome DevTools**: For web debugging

### Useful Commands for Troubleshooting
```bash
npx expo doctor                    # Health check
npx expo start --clear             # Clear cache
rm -rf node_modules && npm install # Fresh install
npx expo export                    # Test production bundle
eas build:list                     # View build history
```

### Environment Variables Access
```javascript
// In app.config.js
process.env.NODE_ENV

// In app code (from extra config)
import Constants from 'expo-constants';
Constants.expoConfig?.extra?.myVariable
```

### Common Patterns
```typescript
// Screen component
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>Hello World!</Text>
    </View>
  );
}

// Navigation
import { router } from 'expo-router';
router.push('/profile');

// Platform-specific code
import { Platform } from 'react-native';
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: { shadowColor: '#000' },
      android: { elevation: 5 },
    }),
  },
});
```

---

## Error Prevention Checklist

### Before Starting Development
- [ ] Verify Node.js and npm versions
- [ ] Install latest Expo CLI and EAS CLI
- [ ] Set up development environment properly
- [ ] Configure Git repository

### During Development
- [ ] Use `npx expo install` for package installation
- [ ] Run `npx expo doctor` regularly
- [ ] Test on both platforms frequently
- [ ] Use TypeScript for better error catching
- [ ] Follow naming conventions for files and components

### Before Building
- [ ] Test production bundle locally (`npx expo export`)
- [ ] Verify all environment variables are set
- [ ] Check app.json/app.config.js configuration
- [ ] Ensure all assets are properly referenced
- [ ] Test on physical devices when possible

### Before Release
- [ ] Test development build thoroughly
- [ ] Configure app signing properly
- [ ] Set up proper app store metadata
- [ ] Test update mechanism if using OTA updates
- [ ] Verify privacy policy and app store requirements

---

*This documentation should be regularly updated as Expo evolves. Always refer to the official Expo documentation for the most current information.*