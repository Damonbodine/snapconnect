/**
 * Typing Indicator Component
 * Shows animated bubble while AI is generating response
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TypingIndicatorProps {
  visible: boolean;
  senderName?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  visible, 
  senderName = 'AI' 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (visible) {
      // Fade in the typing indicator
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Animate the dots in sequence
      const animateDots = () => {
        Animated.sequence([
          Animated.timing(dot1, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dot2, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dot3, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(dot1, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(dot2, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(dot3, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          if (visible) animateDots(); // Loop animation
        });
      };

      animateDots();
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={{ 
        opacity: fadeAnim,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: 16,
        marginHorizontal: 16,
      }}
    >
      <View style={{ maxWidth: '75%' }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 16,
            borderBottomLeftRadius: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 14, 
              color: '#6B7280', 
              marginRight: 8 
            }}>
              {senderName} is typing
            </Text>
            
            {/* Animated dots */}
            <View style={{ flexDirection: 'row' }}>
              <Animated.View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#6B7280',
                  marginHorizontal: 1,
                  opacity: dot1,
                }}
              />
              <Animated.View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#6B7280',
                  marginHorizontal: 1,
                  opacity: dot2,
                }}
              />
              <Animated.View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#6B7280',
                  marginHorizontal: 1,
                  opacity: dot3,
                }}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
};

export default TypingIndicator;