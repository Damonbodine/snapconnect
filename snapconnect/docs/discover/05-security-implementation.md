# Security Implementation for Ephemeral Content

## 🔒 Security Overview

Preventing screenshots and screen recording of ephemeral content is critical for maintaining user privacy and the authentic ephemeral experience. This requires a multi-layered approach across different platforms and app states.

## 📱 Platform-Specific Security

### iOS Security Implementation

#### Screen Recording Detection
```typescript
import { NativeModules, Platform } from 'react-native';

interface iOSSecurityModule {
  isScreenRecording(): Promise<boolean>;
  setSecureFlag(enabled: boolean): void;
  preventScreenCapture(enabled: boolean): void;
}

// Native iOS module (would need native implementation)
const { iOSSecurityModule } = NativeModules;

export const useIOSScreenProtection = () => {
  const [isRecording, setIsRecording] = useState(false);
  
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    
    // Check for screen recording on mount
    iOSSecurityModule?.isScreenRecording().then(setIsRecording);
    
    // Set up screen recording detection
    const checkInterval = setInterval(async () => {
      const recording = await iOSSecurityModule?.isScreenRecording();
      setIsRecording(recording);
    }, 1000);
    
    // Enable screenshot prevention
    iOSSecurityModule?.preventScreenCapture(true);
    
    return () => {
      clearInterval(checkInterval);
      iOSSecurityModule?.preventScreenCapture(false);
    };
  }, []);
  
  return { isRecording };
};
```

#### UIView Security Properties
```swift
// Native iOS implementation needed
class SecureView: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        
        // Prevent screenshots
        if #available(iOS 13.0, *) {
            let field = UITextField()
            field.isSecureTextEntry = true
            field.centerYAnchor.constraint(equalTo: centerYAnchor).isActive = true
            field.centerXAnchor.constraint(equalTo: centerXAnchor).isActive = true
            layer.superlayer?.addSublayer(field.layer)
            field.layer.sublayers?.first?.addSublayer(layer)
        }
    }
}
```

### Android Security Implementation

#### FLAG_SECURE Implementation
```typescript
import { NativeModules } from 'react-native';

interface AndroidSecurityModule {
  setSecureFlag(enabled: boolean): void;
  isScreenRecording(): Promise<boolean>;
  preventScreenshots(enabled: boolean): void;
}

const { AndroidSecurityModule } = NativeModules;

export const useAndroidScreenProtection = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    // Enable FLAG_SECURE to prevent screenshots
    AndroidSecurityModule?.setSecureFlag(true);
    AndroidSecurityModule?.preventScreenshots(true);
    
    return () => {
      AndroidSecurityModule?.setSecureFlag(false);
      AndroidSecurityModule?.preventScreenshots(false);
    };
  }, []);
  
  const checkScreenRecording = useCallback(async () => {
    return await AndroidSecurityModule?.isScreenRecording();
  }, []);
  
  return { checkScreenRecording };
};
```

#### Native Android Implementation
```java
// Native Android implementation needed
public class AndroidSecurityModule extends ReactContextBaseJavaModule {
    
    @ReactMethod
    public void setSecureFlag(boolean enabled) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity != null) {
            if (enabled) {
                currentActivity.getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                currentActivity.getWindow().clearFlags(
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            }
        }
    }
    
    @ReactMethod
    public void isScreenRecording(Promise promise) {
        // Detect screen recording (Android 10+)
        MediaProjectionManager manager = 
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        // Implementation depends on Android version
        promise.resolve(false);
    }
}
```

## 🛡️ React Native Security Components

### SecureView Component

```typescript
import React, { useEffect, useState } from 'react';
import { View, ViewProps, Platform, AppState } from 'react-native';
import { BlurView } from 'expo-blur';

interface SecureViewProps extends ViewProps {
  children: React.ReactNode;
  securityLevel: 'high' | 'medium' | 'low';
  onSecurityBreach?: (type: 'screenshot' | 'recording') => void;
}

export const SecureView: React.FC<SecureViewProps> = ({
  children,
  securityLevel,
  onSecurityBreach,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  
  const { isRecording: iosRecording } = useIOSScreenProtection();
  const { checkScreenRecording } = useAndroidScreenProtection();
  
  // Monitor app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      setAppState(nextAppState);
      
      // Hide content when app goes to background
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsSecure(false);
      } else if (nextAppState === 'active') {
        setIsSecure(true);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);
  
  // Monitor screen recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const checkRecording = async () => {
      let isRecording = false;
      
      if (Platform.OS === 'ios') {
        isRecording = iosRecording;
      } else if (Platform.OS === 'android') {
        isRecording = await checkScreenRecording();
      }
      
      if (isRecording) {
        setIsSecure(false);
        onSecurityBreach?.('recording');
      } else {
        setIsSecure(true);
      }
    };
    
    if (securityLevel === 'high') {
      interval = setInterval(checkRecording, 500); // Check every 500ms
    } else if (securityLevel === 'medium') {
      interval = setInterval(checkRecording, 2000); // Check every 2s
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [securityLevel, iosRecording, checkScreenRecording, onSecurityBreach]);
  
  const renderSecureContent = () => {
    if (!isSecure) {
      return (
        <BlurView intensity={100} style={{ flex: 1 }}>
          <View className="flex-1 items-center justify-center bg-black/80">
            <Text className="text-white text-center">
              Content hidden for security
            </Text>
          </View>
        </BlurView>
      );
    }
    
    return children;
  };
  
  return (
    <View {...props}>
      {renderSecureContent()}
    </View>
  );
};
```

### SecureImage Component

```typescript
import React, { useState } from 'react';
import { Image, ImageProps, View } from 'react-native';
import { useSecurityContext } from '../contexts/SecurityContext';

interface SecureImageProps extends ImageProps {
  source: { uri: string };
  fallbackText?: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({
  source,
  fallbackText = "Image protected",
  style,
  ...props
}) => {
  const { isSecureMode } = useSecurityContext();
  const [imageError, setImageError] = useState(false);
  
  if (!isSecureMode || imageError) {
    return (
      <View 
        style={[
          style, 
          { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }
        ]}
      >
        <Text className="text-gray-400">{fallbackText}</Text>
      </View>
    );
  }
  
  return (
    <Image
      {...props}
      source={source}
      style={style}
      onError={() => setImageError(true)}
    />
  );
};
```

### SecureVideo Component

```typescript
import React, { useState, useCallback } from 'react';
import { Video, VideoProps, ResizeMode } from 'expo-av';
import { View, Text } from 'react-native';
import { useSecurityContext } from '../contexts/SecurityContext';

interface SecureVideoProps extends Omit<VideoProps, 'source'> {
  source: { uri: string };
  onSecurityBreach?: () => void;
}

export const SecureVideo: React.FC<SecureVideoProps> = ({
  source,
  onSecurityBreach,
  style,
  ...props
}) => {
  const { isSecureMode, securityLevel } = useSecurityContext();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
    
    // If high security and video is playing, extra monitoring
    if (securityLevel === 'high' && status.isPlaying) {
      // Could implement additional security checks here
    }
  }, [securityLevel]);
  
  if (!isSecureMode) {
    return (
      <View style={[style, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text className="text-gray-400">Video protected</Text>
      </View>
    );
  }
  
  return (
    <Video
      {...props}
      source={source}
      style={style}
      onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      resizeMode={ResizeMode.COVER}
      shouldPlay={false} // Require user interaction
      useNativeControls={false} // Custom controls only
    />
  );
};
```

## 🔐 Security Context Provider

### SecurityContext Implementation

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

interface SecurityContextType {
  isSecureMode: boolean;
  securityLevel: 'high' | 'medium' | 'low';
  isScreenRecording: boolean;
  setSecurityLevel: (level: 'high' | 'medium' | 'low') => void;
  onSecurityBreach: (type: string) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [isSecureMode, setIsSecureMode] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  
  // Monitor app state for security
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsSecureMode(false);
      } else if (nextAppState === 'active') {
        setIsSecureMode(true);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);
  
  // Screen recording detection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (securityLevel === 'high') {
      interval = setInterval(async () => {
        // Platform-specific recording detection
        const recording = await detectScreenRecording();
        setIsScreenRecording(recording);
        
        if (recording) {
          setIsSecureMode(false);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [securityLevel]);
  
  const onSecurityBreach = useCallback((type: string) => {
    console.warn(`Security breach detected: ${type}`);
    setIsSecureMode(false);
    
    // Could implement additional breach responses:
    // - Log to analytics
    // - Show warning to user
    // - Temporarily disable content
  }, []);
  
  const value: SecurityContextType = {
    isSecureMode,
    securityLevel,
    isScreenRecording,
    setSecurityLevel,
    onSecurityBreach,
  };
  
  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within SecurityProvider');
  }
  return context;
};
```

## 🚨 Security Event Handling

### Security Breach Detection

```typescript
interface SecurityBreach {
  type: 'screenshot' | 'recording' | 'background' | 'dev_tools';
  timestamp: number;
  additionalInfo?: any;
}

export const useSecurityMonitoring = () => {
  const [breaches, setBreaches] = useState<SecurityBreach[]>([]);
  
  const reportBreach = useCallback((breach: SecurityBreach) => {
    setBreaches(prev => [...prev, breach]);
    
    // Log to analytics (anonymized)
    analytics.track('security_breach', {
      type: breach.type,
      timestamp: breach.timestamp,
      // Don't include sensitive info
    });
    
    // Could implement auto-logout or content hiding
    if (breach.type === 'recording') {
      // Force logout or hide all content
    }
  }, []);
  
  const clearBreaches = useCallback(() => {
    setBreaches([]);
  }, []);
  
  return {
    breaches,
    reportBreach,
    clearBreaches,
  };
};
```

### Developer Tools Detection

```typescript
export const useDevToolsDetection = () => {
  useEffect(() => {
    if (__DEV__) {
      // In development mode, warn about dev tools
      console.warn('Development mode detected - security features may be limited');
      return;
    }
    
    // Production security checks
    const checkDevTools = () => {
      // Detect if React Native debugger is connected
      if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.warn('Dev tools detected in production');
        return true;
      }
      
      // Detect Chrome DevTools (if web)
      if (typeof window !== 'undefined') {
        const threshold = 160;
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          return true;
        }
      }
      
      return false;
    };
    
    const interval = setInterval(() => {
      if (checkDevTools()) {
        // Handle dev tools detection
        console.warn('Developer tools detected');
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
};
```

## 🛠️ Third-Party Security Libraries

### Recommended Libraries

```typescript
// react-native-prevent-screenshot
import { preventScreenshot, allowScreenshot } from 'react-native-prevent-screenshot';

export const useScreenshotPrevention = (enabled: boolean) => {
  useEffect(() => {
    if (enabled) {
      preventScreenshot();
    } else {
      allowScreenshot();
    }
    
    return () => {
      allowScreenshot(); // Always cleanup
    };
  }, [enabled]);
};
```

### Integration with Expo

```typescript
// For Expo managed workflow
import * as ScreenCapture from 'expo-screen-capture';

export const useExpoScreenProtection = () => {
  useEffect(() => {
    const preventAsync = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (error) {
        console.warn('Screen capture prevention not available');
      }
    };
    
    preventAsync();
    
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(console.warn);
    };
  }, []);
  
  const [hasPermissions, setHasPermissions] = useState(false);
  
  useEffect(() => {
    ScreenCapture.getPermissionsAsync()
      .then(({ status }) => setHasPermissions(status === 'granted'))
      .catch(() => setHasPermissions(false));
  }, []);
  
  return { hasPermissions };
};
```

## 📊 Security Configuration

### Environment-Based Security

```typescript
interface SecurityConfig {
  development: {
    enableScreenProtection: boolean;
    enableRecordingDetection: boolean;
    logSecurityEvents: boolean;
  };
  production: {
    enableScreenProtection: boolean;
    enableRecordingDetection: boolean;
    logSecurityEvents: boolean;
  };
}

const securityConfig: SecurityConfig = {
  development: {
    enableScreenProtection: false, // Allow screenshots in dev
    enableRecordingDetection: false,
    logSecurityEvents: true,
  },
  production: {
    enableScreenProtection: true,
    enableRecordingDetection: true,
    logSecurityEvents: false, // Don't log in production for privacy
  },
};

export const getSecurityConfig = () => {
  return __DEV__ ? securityConfig.development : securityConfig.production;
};
```

### User Preference Settings

```typescript
interface SecurityPreferences {
  allowScreenshots: boolean; // User override (if permitted)
  securityLevel: 'high' | 'medium' | 'low';
  notifyOnBreach: boolean;
}

export const useSecurityPreferences = () => {
  const [preferences, setPreferences] = useState<SecurityPreferences>({
    allowScreenshots: false,
    securityLevel: 'high',
    notifyOnBreach: true,
  });
  
  const updatePreferences = useCallback((newPrefs: Partial<SecurityPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));
  }, []);
  
  return { preferences, updatePreferences };
};
```

## 🧪 Testing Security Features

### Security Testing Utils

```typescript
export const SecurityTestUtils = {
  // Simulate security breaches for testing
  simulateScreenshot: () => {
    console.log('🧪 Simulating screenshot attempt');
    // Trigger security response
  },
  
  simulateRecording: () => {
    console.log('🧪 Simulating screen recording');
    // Trigger recording detection
  },
  
  simulateAppBackground: () => {
    console.log('🧪 Simulating app backgrounding');
    // Trigger background security
  },
  
  testSecurityComponents: async () => {
    console.log('🧪 Testing security component responses');
    // Run security component tests
  },
};
```

### Security Metrics

```typescript
interface SecurityMetrics {
  breachAttempts: number;
  falsePositives: number;
  securityUptime: number;
  userSecurityScore: number;
}

export const useSecurityMetrics = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    breachAttempts: 0,
    falsePositives: 0,
    securityUptime: 100,
    userSecurityScore: 100,
  });
  
  const updateMetrics = useCallback((update: Partial<SecurityMetrics>) => {
    setMetrics(prev => ({ ...prev, ...update }));
  }, []);
  
  return { metrics, updateMetrics };
};
```

## 🚀 Implementation Checklist

### Phase 1: Basic Protection
- [ ] Implement SecureView component
- [ ] Add platform-specific FLAG_SECURE
- [ ] Implement app state monitoring
- [ ] Add basic screenshot prevention

### Phase 2: Advanced Detection
- [ ] Implement screen recording detection
- [ ] Add dev tools detection
- [ ] Implement security breach logging
- [ ] Add user security preferences

### Phase 3: Polish & Testing
- [ ] Add security metrics monitoring
- [ ] Implement graceful degradation
- [ ] Add comprehensive testing
- [ ] Document security limitations

---

**Status**: Security architecture defined  
**Critical Dependencies**: Native modules for platform-specific features  
**Security Level**: High - suitable for sensitive ephemeral content  
**Platform Support**: iOS and Android with graceful web fallbacks