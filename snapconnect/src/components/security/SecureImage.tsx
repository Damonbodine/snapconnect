import React, { useState } from 'react';
import { Image, ImageProps, View, Text } from 'react-native';
import { useSecurityContext } from '../../contexts/SecurityContext';

interface SecureImageProps extends Omit<ImageProps, 'source'> {
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
        <Text className="text-gray-400 text-center">{fallbackText}</Text>
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