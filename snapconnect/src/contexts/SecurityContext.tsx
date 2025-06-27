import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, Platform } from 'react-native';

export type SecurityLevel = 'high' | 'medium' | 'low';

export interface SecurityContextType {
  // Security state
  isSecureMode: boolean;
  securityLevel: SecurityLevel;
  isScreenRecording: boolean;
  isAppInBackground: boolean;
  
  // Security controls
  setSecurityLevel: (level: SecurityLevel) => void;
  enableSecureMode: () => void;
  disableSecureMode: () => void;
  
  // Breach handling
  onSecurityBreach: (type: SecurityBreachType, details?: any) => void;
  
  // Settings
  allowUserOverride: boolean;
  setAllowUserOverride: (allow: boolean) => void;
}

export type SecurityBreachType = 
  | 'screenshot' 
  | 'recording' 
  | 'background' 
  | 'dev_tools'
  | 'unauthorized_access';

interface SecurityBreach {
  type: SecurityBreachType;
  timestamp: number;
  details?: any;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

interface SecurityProviderProps {
  children: React.ReactNode;
  initialSecurityLevel?: SecurityLevel;
  allowUserOverride?: boolean;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({
  children,
  initialSecurityLevel = 'high',
  allowUserOverride = false,
}) => {
  const [isSecureMode, setIsSecureMode] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(initialSecurityLevel);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isAppInBackground, setIsAppInBackground] = useState(false);
  const [allowUserOverrideState, setAllowUserOverride] = useState(allowUserOverride);
  const [securityBreaches, setSecurityBreaches] = useState<SecurityBreach[]>([]);
  
  // Monitor app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      const isBackground = nextAppState === 'background' || nextAppState === 'inactive';
      setIsAppInBackground(isBackground);
      
      if (isBackground) {
        // Disable secure mode when app goes to background for security
        setIsSecureMode(false);
      } else if (nextAppState === 'active') {
        // Re-enable secure mode when app becomes active
        setIsSecureMode(true);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);
  
  // Screen recording detection (placeholder - would need native implementation)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (securityLevel === 'high') {
      interval = setInterval(async () => {
        // This would call native modules to detect screen recording
        // For now, we'll use a placeholder implementation
        const isRecording = await detectScreenRecording();
        
        if (isRecording !== isScreenRecording) {
          setIsScreenRecording(isRecording);
          
          if (isRecording) {
            onSecurityBreach('recording', { 
              detectedAt: Date.now(),
              platform: Platform.OS,
            });
          }
        }
      }, 1000); // Check every second for high security
    } else if (securityLevel === 'medium') {
      interval = setInterval(async () => {
        const isRecording = await detectScreenRecording();
        setIsScreenRecording(isRecording);
      }, 3000); // Check every 3 seconds for medium security
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [securityLevel, isScreenRecording]);
  
  // Placeholder function for screen recording detection
  const detectScreenRecording = async (): Promise<boolean> => {
    // This would be implemented with native modules
    // For iOS: Check if screen is being captured
    // For Android: Check for recording apps or MediaProjection API usage
    
    if (__DEV__) {
      // In development, randomly simulate detection for testing
      return Math.random() < 0.01; // 1% chance of "detection"
    }
    
    return false;
  };
  
  const enableSecureMode = useCallback(() => {
    setIsSecureMode(true);
  }, []);
  
  const disableSecureMode = useCallback(() => {
    if (allowUserOverrideState || __DEV__) {
      setIsSecureMode(false);
    }
  }, [allowUserOverrideState]);
  
  const onSecurityBreach = useCallback((type: SecurityBreachType, details?: any) => {
    const breach: SecurityBreach = {
      type,
      timestamp: Date.now(),
      details,
    };
    
    setSecurityBreaches(prev => [...prev, breach]);
    
    // Log breach (in production, this would go to analytics)
    console.warn(`🚨 Security breach detected: ${type}`, details);
    
    // Take immediate action based on breach type
    switch (type) {
      case 'screenshot':
      case 'recording':
        // Temporarily disable secure mode or blur content
        setIsSecureMode(false);
        setTimeout(() => setIsSecureMode(true), 3000); // Re-enable after 3 seconds
        break;
        
      case 'background':
        // App went to background - content is already hidden
        break;
        
      case 'dev_tools':
        // Development tools detected
        if (!__DEV__) {
          setIsSecureMode(false);
        }
        break;
        
      case 'unauthorized_access':
        // Someone trying to access content they shouldn't
        setIsSecureMode(false);
        break;
    }
  }, []);
  
  // Monitor for developer tools in production
  useEffect(() => {
    if (__DEV__) return;
    
    const checkDevTools = () => {
      // Check for React Native debugger
      if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        onSecurityBreach('dev_tools', { type: 'react_devtools' });
      }
      
      // Check for other debugging indicators
      if (typeof window !== 'undefined' && window.chrome?.runtime) {
        onSecurityBreach('dev_tools', { type: 'chrome_devtools' });
      }
    };
    
    const interval = setInterval(checkDevTools, 5000);
    return () => clearInterval(interval);
  }, [onSecurityBreach]);
  
  const value: SecurityContextType = {
    // State
    isSecureMode,
    securityLevel,
    isScreenRecording,
    isAppInBackground,
    
    // Controls
    setSecurityLevel,
    enableSecureMode,
    disableSecureMode,
    
    // Breach handling
    onSecurityBreach,
    
    // Settings
    allowUserOverride: allowUserOverrideState,
    setAllowUserOverride,
  };
  
  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurityContext = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return context;
};

// Hook for monitoring security metrics
export const useSecurityMetrics = () => {
  const [metrics, setMetrics] = useState({
    breachCount: 0,
    lastBreachTime: null as number | null,
    secureSessionDuration: 0,
    breachTypes: {} as Record<SecurityBreachType, number>,
  });
  
  const { onSecurityBreach } = useSecurityContext();
  
  useEffect(() => {
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        secureSessionDuration: Date.now() - startTime,
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const originalOnBreach = onSecurityBreach;
  const trackingOnBreach = useCallback((type: SecurityBreachType, details?: any) => {
    setMetrics(prev => ({
      ...prev,
      breachCount: prev.breachCount + 1,
      lastBreachTime: Date.now(),
      breachTypes: {
        ...prev.breachTypes,
        [type]: (prev.breachTypes[type] || 0) + 1,
      },
    }));
    
    originalOnBreach(type, details);
  }, [originalOnBreach]);
  
  return {
    metrics,
    trackBreach: trackingOnBreach,
  };
};

// Hook for environment-based security configuration
export const useEnvironmentSecurity = () => {
  const config = {
    development: {
      enableScreenProtection: false,
      enableRecordingDetection: false,
      logSecurityEvents: true,
      allowUserOverride: true,
    },
    production: {
      enableScreenProtection: true,
      enableRecordingDetection: true,
      logSecurityEvents: false,
      allowUserOverride: false,
    },
  };
  
  return __DEV__ ? config.development : config.production;
};