/// <reference types="nativewind/types" />

declare module "react-native" {
  namespace ReactNative {
    interface ViewProps {
      className?: string;
    }
    interface TextProps {
      className?: string;
    }
    interface PressableProps {
      className?: string;
    }
    interface ScrollViewProps {
      className?: string;
    }
    interface TextInputProps {
      className?: string;
    }
  }
}

declare module "expo-linear-gradient" {
  interface LinearGradientProps {
    className?: string;
  }
}