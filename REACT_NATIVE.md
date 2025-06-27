# React Native Development Guide for SnapConnect

*Comprehensive documentation for AI Assistant development with React Native*

## Table of Contents

1. [Introduction to React Native](#introduction-to-react-native)
2. [Development Environment Setup](#development-environment-setup)
3. [Core Concepts & Architecture](#core-concepts--architecture)
4. [Essential Components](#essential-components)
5. [Styling & Layout](#styling--layout)
6. [Navigation Patterns](#navigation-patterns)
7. [Platform-Specific Development](#platform-specific-development)
8. [Performance Optimization](#performance-optimization)
9. [Debugging & Testing](#debugging--testing)
10. [Common Patterns & Best Practices](#common-patterns--best-practices)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [API Reference](#api-reference)

---

## Introduction to React Native

### What is React Native?

React Native is a JavaScript-based mobile application development framework that enables building native mobile applications for both Android and iOS platforms using React. Unlike web-based hybrid solutions, React Native compiles to truly native mobile components.

### Key Benefits

- **Cross-Platform Development**: Write once, run on both iOS and Android
- **Native Performance**: Compiles to native components, not web views
- **React Ecosystem**: Leverage existing React knowledge and libraries
- **Hot Reloading**: Fast development cycle with instant updates
- **Large Community**: Extensive third-party library ecosystem

### How React Native Works

```
JavaScript Code → Metro Bundler → Native Modules → Platform UI Components
```

- **JavaScript Thread**: Runs your React code
- **Native Thread**: Handles UI rendering and native operations
- **Bridge**: Communicates between JavaScript and native code

---

## Development Environment Setup

### Prerequisites

```bash
# Required Tools
- Node.js (16.x or later LTS)
- npm or yarn
- Git
- Code editor (VS Code recommended)

# Platform-Specific Requirements
# iOS Development (macOS only)
- Xcode 12.x or later
- iOS Simulator
- CocoaPods

# Android Development
- Android Studio
- Android SDK (API level 30+)
- Android Virtual Device (AVD)
```

### Installation Steps

**1. Install React Native CLI:**
```bash
npm install -g react-native-cli
# OR for Expo projects
npm install -g @expo/cli
```

**2. Verify Installation:**
```bash
react-native --version
npx react-native doctor  # Health check
```

**3. Platform Setup:**
```bash
# iOS (macOS only)
sudo gem install cocoapods
pod --version

# Android
# Install Android Studio
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## Core Concepts & Architecture

### Component Hierarchy

React Native follows the same component-based architecture as React:

```typescript
// App Component (Root)
├── Navigation Container
│   ├── Stack Navigator
│   │   ├── Screen Components
│   │   │   ├── View Components
│   │   │   ├── Text Components
│   │   │   └── Interactive Components
│   │   └── Modal Components
│   └── Tab Navigator
└── Providers (Context, State Management)
```

### Component Types

**1. Core Components (Built-in)**
- Pre-built components that map to native UI elements
- Examples: `View`, `Text`, `Image`, `ScrollView`

**2. Native Components**
- Platform-specific components exposed to JavaScript
- Examples: `DatePickerIOS`, `DrawerLayoutAndroid`

**3. Composite Components**
- Custom components built from core/native components
- Your app's custom UI elements

### React Native vs Web React Differences

| Feature | React (Web) | React Native |
|---------|-------------|--------------|
| DOM Elements | `<div>`, `<span>`, `<p>` | `<View>`, `<Text>`, `<ScrollView>` |
| Styling | CSS files, CSS-in-JS | StyleSheet object, inline styles |
| Events | onClick, onSubmit | onPress, onChangeText |
| Navigation | React Router | React Navigation |
| Layout | CSS Flexbox | Yoga Flexbox (similar but different) |
| Platform APIs | Browser APIs | Native mobile APIs |

---

## Essential Components

### View - The Foundation Component

The `View` component is the fundamental building block, similar to `<div>` in HTML:

```typescript
import { View, StyleSheet } from 'react-native';

const Container = () => (
  <View style={styles.container}>
    <View style={styles.box}>
      {/* Child components */}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  box: {
    width: 100,
    height: 100,
    backgroundColor: 'blue',
    borderRadius: 10,
  },
});
```

**Key Properties:**
- `style`: Styling object
- `pointerEvents`: Touch event handling
- `accessible`: Accessibility support
- `testID`: Testing identifier

### Text - Display Text Content

All text must be wrapped in `<Text>` components:

```typescript
import { Text, StyleSheet } from 'react-native';

const TextExample = () => (
  <View>
    <Text style={styles.title}>Main Title</Text>
    <Text style={styles.body}>
      This is body text with <Text style={styles.bold}>bold</Text> content.
    </Text>
    <Text numberOfLines={2} ellipsizeMode="tail">
      This is a very long text that will be truncated after two lines...
    </Text>
  </View>
);

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  bold: {
    fontWeight: 'bold',
  },
});
```

**Key Properties:**
- `numberOfLines`: Limit text lines
- `ellipsizeMode`: Text truncation behavior
- `selectable`: Allow text selection
- `allowFontScaling`: Respect system font scaling

### Image - Display Images

```typescript
import { Image, ImageBackground } from 'react-native';

const ImageExample = () => (
  <View>
    {/* Local Image */}
    <Image 
      source={require('./assets/logo.png')} 
      style={styles.logo}
      resizeMode="contain"
    />
    
    {/* Network Image */}
    <Image 
      source={{ uri: 'https://example.com/image.jpg' }}
      style={styles.networkImage}
      onLoad={() => console.log('Image loaded')}
      onError={() => console.log('Image failed to load')}
    />
    
    {/* Background Image */}
    <ImageBackground 
      source={require('./assets/background.jpg')}
      style={styles.backgroundImage}
    >
      <Text style={styles.overlayText}>Text over image</Text>
    </ImageBackground>
  </View>
);

const styles = StyleSheet.create({
  logo: {
    width: 100,
    height: 100,
  },
  networkImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  backgroundImage: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

**Resize Modes:**
- `cover`: Scale to fill container (may crop)
- `contain`: Scale to fit container (maintains aspect ratio)
- `stretch`: Stretch to fill container
- `center`: Center image without scaling

### ScrollView - Scrollable Container

```typescript
import { ScrollView, RefreshControl } from 'react-native';

const ScrollExample = () => {
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = () => {
    setRefreshing(true);
    // Fetch new data
    setTimeout(() => setRefreshing(false), 2000);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Content */}
      {Array.from({ length: 20 }).map((_, index) => (
        <View key={index} style={styles.item}>
          <Text>Item {index + 1}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  item: {
    padding: 20,
    marginVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
});
```

### FlatList - Performance-Optimized Lists

For large lists, use `FlatList` instead of `ScrollView`:

```typescript
import { FlatList } from 'react-native';

interface Item {
  id: string;
  title: string;
  description: string;
}

const ListExample = () => {
  const data: Item[] = [
    { id: '1', title: 'Item 1', description: 'Description 1' },
    { id: '2', title: 'Item 2', description: 'Description 2' },
    // ... more items
  ];

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.listItem}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.itemDescription}>{item.description}</Text>
    </View>
  );

  const ItemSeparator = () => <View style={styles.separator} />;

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={ItemSeparator}
      showsVerticalScrollIndicator={false}
      onEndReached={() => console.log('Load more items')}
      onEndReachedThreshold={0.1}
      refreshing={false}
      onRefresh={() => console.log('Refresh')}
    />
  );
};
```

### TextInput - User Input

```typescript
import { TextInput } from 'react-native';

const InputExample = () => {
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');

  return (
    <View>
      {/* Basic Text Input */}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Enter text here"
        placeholderTextColor="#999"
      />
      
      {/* Email Input */}
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      
      {/* Password Input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        textContentType="password"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginVertical: 10,
  },
});
```

### Touchable Components

React Native provides several touchable components for handling user interactions:

```typescript
import { 
  TouchableOpacity, 
  TouchableHighlight, 
  TouchableWithoutFeedback,
  Pressable
} from 'react-native';

const TouchableExample = () => (
  <View>
    {/* TouchableOpacity - Reduces opacity on press */}
    <TouchableOpacity 
      style={styles.button}
      onPress={() => console.log('TouchableOpacity pressed')}
      activeOpacity={0.7}
    >
      <Text style={styles.buttonText}>TouchableOpacity</Text>
    </TouchableOpacity>
    
    {/* TouchableHighlight - Shows highlight on press */}
    <TouchableHighlight
      style={styles.button}
      onPress={() => console.log('TouchableHighlight pressed')}
      underlayColor="#ddd"
    >
      <Text style={styles.buttonText}>TouchableHighlight</Text>
    </TouchableHighlight>
    
    {/* Pressable - Modern touchable with more features */}
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed
      ]}
      onPress={() => console.log('Pressable pressed')}
      onLongPress={() => console.log('Long press')}
    >
      {({ pressed }) => (
        <Text style={[styles.buttonText, pressed && styles.pressedText]}>
          Pressable
        </Text>
      )}
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pressed: {
    backgroundColor: '#0056CC',
  },
  pressedText: {
    color: '#ddd',
  },
});
```

---

## Styling & Layout

### StyleSheet Object

React Native uses JavaScript objects for styling, similar to CSS but with camelCase properties:

```typescript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
});
```

### Flexbox Layout

React Native uses Flexbox for layout, with some defaults different from web CSS:

```typescript
// Default Flexbox Values in React Native
const defaultStyles = {
  flexDirection: 'column',  // vs 'row' on web
  alignItems: 'stretch',
  flexShrink: 0,           // vs 1 on web
};

// Common Flexbox Patterns
const flexboxExamples = StyleSheet.create({
  // Full screen container
  fullScreen: {
    flex: 1,
  },
  
  // Horizontal row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Center content
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Space between items
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // Equal width columns
  column: {
    flex: 1,
  },
  
  // Fixed size item
  fixedSize: {
    width: 100,
    height: 100,
  },
});
```

### Flexbox Properties Reference

**Main Axis (flexDirection):**
- `justifyContent`: `flex-start` | `flex-end` | `center` | `space-between` | `space-around` | `space-evenly`

**Cross Axis:**
- `alignItems`: `flex-start` | `flex-end` | `center` | `stretch` | `baseline`
- `alignSelf`: Override `alignItems` for individual items

**Flex Properties:**
- `flex`: Shorthand for flexGrow, flexShrink, flexBasis
- `flexGrow`: How much item should grow
- `flexShrink`: How much item should shrink
- `flexBasis`: Default size before free space distribution

### Dimensions and Units

```typescript
import { Dimensions, PixelRatio } from 'react-native';

// Get device dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const { width: deviceWidth, height: deviceHeight } = Dimensions.get('screen');

// Pixel density
const pixelRatio = PixelRatio.get();
const fontScale = PixelRatio.getFontScale();

// Responsive dimensions
const responsiveStyles = StyleSheet.create({
  fullWidth: {
    width: screenWidth,
  },
  halfWidth: {
    width: screenWidth * 0.5,
  },
  responsiveFont: {
    fontSize: 16 * fontScale,
  },
});

// Listen for orientation changes
useEffect(() => {
  const subscription = Dimensions.addEventListener('change', ({ window, screen }) => {
    console.log('Dimensions changed:', window, screen);
  });
  
  return () => subscription?.remove();
}, []);
```

### Colors and Gradients

```typescript
// Color formats supported
const colorExamples = StyleSheet.create({
  hexColor: {
    backgroundColor: '#FF6B6B',
  },
  rgbaColor: {
    backgroundColor: 'rgba(255, 107, 107, 0.8)',
  },
  namedColor: {
    backgroundColor: 'red',
  },
  hslColor: {
    backgroundColor: 'hsl(0, 100%, 50%)',
  },
});

// For gradients, use expo-linear-gradient or react-native-linear-gradient
import { LinearGradient } from 'expo-linear-gradient';

const GradientExample = () => (
  <LinearGradient
    colors={['#FF6B6B', '#4ECDC4']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.gradient}
  >
    <Text style={styles.gradientText}>Gradient Background</Text>
  </LinearGradient>
);
```

### Platform-Specific Styles

```typescript
import { Platform } from 'react-native';

const platformStyles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 44 : 0, // iOS status bar
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
});
```

---

## Navigation Patterns

### React Navigation Setup

React Navigation is the standard navigation library for React Native:

```bash
npm install @react-navigation/native
npm install react-native-screens react-native-safe-area-context

# For Stack Navigator
npm install @react-navigation/stack
npm install react-native-gesture-handler

# For Tab Navigator  
npm install @react-navigation/bottom-tabs

# For Drawer Navigator
npm install @react-navigation/drawer
npm install react-native-gesture-handler react-native-reanimated
```

### Stack Navigation

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Welcome' }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={({ route }) => ({ title: `User ${route.params.userId}` })}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

// Navigation in components
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  return (
    <View>
      <Button
        title="Go to Profile"
        onPress={() => navigation.navigate('Profile', { userId: '123' })}
      />
      <Button
        title="Go Back"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
};
```

### Tab Navigation

```typescript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

type TabParamList = {
  Home: undefined;
  Search: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: string;

        switch (route.name) {
          case 'Home':
            iconName = focused ? 'home' : 'home-outline';
            break;
          case 'Search':
            iconName = focused ? 'search' : 'search-outline';
            break;
          case 'Profile':
            iconName = focused ? 'person' : 'person-outline';
            break;
          default:
            iconName = 'circle';
        }

        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);
```

---

## Platform-Specific Development

### Platform Detection

```typescript
import { Platform } from 'react-native';

// Check current platform
console.log(Platform.OS); // 'ios' | 'android' | 'web'
console.log(Platform.Version); // iOS: string, Android: number

// Platform-specific code
if (Platform.OS === 'ios') {
  // iOS-specific logic
} else if (Platform.OS === 'android') {
  // Android-specific logic
}

// Platform.select for conditional values
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        backgroundColor: 'red',
      },
      android: {
        backgroundColor: 'blue',
      },
      default: {
        backgroundColor: 'gray',
      },
    }),
  },
});
```

### Platform-Specific Files

You can create platform-specific files using extensions:

```
components/
├── Button.tsx           # Shared component
├── Button.ios.tsx       # iOS-specific version
├── Button.android.tsx   # Android-specific version
└── Button.native.tsx    # Native platforms (not web)
```

### Safe Areas

```typescript
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Provider at app root
const App = () => (
  <SafeAreaProvider>
    <Navigation />
  </SafeAreaProvider>
);

// SafeAreaView component
const Screen = () => (
  <SafeAreaView style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      {/* Your content */}
    </View>
  </SafeAreaView>
);

// Using insets directly
const CustomHeader = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: '#007AFF' }}>
      <Text>Header</Text>
    </View>
  );
};
```

---

## Performance Optimization

### Image Optimization

```typescript
// Optimize images
const OptimizedImage = ({ source, style }) => (
  <Image
    source={source}
    style={style}
    resizeMode="cover"
    // Enable native image caching
    cache="force-cache"
    // Use progressive JPEG loading
    progressiveRenderingEnabled={true}
    // Reduce memory usage
    fadeDuration={0}
  />
);

// Use expo-image for better performance
import { Image as ExpoImage } from 'expo-image';

const ExpoImageExample = () => (
  <ExpoImage
    source="https://example.com/image.jpg"
    style={{ width: 200, height: 200 }}
    placeholder={require('./placeholder.png')}
    contentFit="cover"
    transition={1000}
  />
);
```

### FlatList Performance

```typescript
const OptimizedFlatList = () => (
  <FlatList
    data={data}
    renderItem={renderItem}
    keyExtractor={(item) => item.id}
    
    // Performance optimizations
    removeClippedSubviews={true}
    maxToRenderPerBatch={10}
    windowSize={10}
    initialNumToRender={10}
    updateCellsBatchingPeriod={50}
    
    // Memory optimizations
    getItemLayout={(data, index) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    })}
    
    // Reduce re-renders
    keyboardShouldPersistTaps="handled"
  />
);

// Memoize list items
const ListItem = React.memo(({ item }) => (
  <View style={styles.item}>
    <Text>{item.title}</Text>
  </View>
));
```

### Memory Management

```typescript
// Clean up subscriptions
useEffect(() => {
  const subscription = someService.subscribe(callback);
  
  return () => {
    subscription.unsubscribe();
  };
}, []);

// Use useMemo and useCallback appropriately
const ExpensiveComponent = ({ data, onPress }) => {
  const expensiveValue = useMemo(() => {
    return data.map(item => processItem(item));
  }, [data]);

  const handlePress = useCallback((id) => {
    onPress(id);
  }, [onPress]);

  return (
    <View>
      {expensiveValue.map(item => (
        <Item key={item.id} data={item} onPress={handlePress} />
      ))}
    </View>
  );
};
```

---

## Debugging & Testing

### Development Tools

```typescript
// Enable debugging
if (__DEV__) {
  console.log('Development mode');
  
  // React Native Debugger
  // Flipper integration
  // Performance monitor
}

// Remote debugging
// In simulator: Cmd+D (iOS) or Cmd+M (Android)
// Enable "Debug JS Remotely"
```

### Console Logging

```typescript
// Different log levels
console.log('Info message');
console.warn('Warning message');
console.error('Error message');

// Group related logs
console.group('User Actions');
console.log('User logged in');
console.log('Profile updated');
console.groupEnd();

// Performance timing
console.time('API Call');
// ... async operation
console.timeEnd('API Call');
```

### Error Boundaries

```typescript
import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to crash reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong.</Text>
          <Button title="Try Again" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }

    return this.props.children;
  }
}

// Usage
const App = () => (
  <ErrorBoundary>
    <MainApp />
  </ErrorBoundary>
);
```

### Testing with Jest

```typescript
// Component testing
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  test('renders correctly', () => {
    const { getByText } = render(<Button title="Test Button" />);
    expect(getByText('Test Button')).toBeTruthy();
  });

  test('handles press events', () => {
    const mockPress = jest.fn();
    const { getByText } = render(
      <Button title="Test Button" onPress={mockPress} />
    );
    
    fireEvent.press(getByText('Test Button'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });
});

// Snapshot testing
test('matches snapshot', () => {
  const tree = render(<Button title="Snapshot Test" />).toJSON();
  expect(tree).toMatchSnapshot();
});
```

---

## Common Patterns & Best Practices

### State Management

```typescript
// Local state with useState
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);

// Effect for side effects
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.getData();
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

// Custom hooks for reusable logic
const useApiData = (url: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then(response => response.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
};
```

### Component Patterns

```typescript
// Compound components
const Card = ({ children, ...props }) => (
  <View style={styles.card} {...props}>
    {children}
  </View>
);

Card.Header = ({ children }) => (
  <View style={styles.cardHeader}>
    {children}
  </View>
);

Card.Body = ({ children }) => (
  <View style={styles.cardBody}>
    {children}
  </View>
);

// Usage
<Card>
  <Card.Header>
    <Text>Card Title</Text>
  </Card.Header>
  <Card.Body>
    <Text>Card content</Text>
  </Card.Body>
</Card>

// Render props pattern
const DataProvider = ({ children, url }) => {
  const { data, loading, error } = useApiData(url);
  
  return children({ data, loading, error });
};

// Usage
<DataProvider url="/api/users">
  {({ data, loading, error }) => {
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} />;
    return <UserList users={data} />;
  }}
</DataProvider>
```

### File Organization

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── forms/          # Form-related components
│   └── layout/         # Layout components
├── screens/            # Screen components
├── navigation/         # Navigation configuration
├── hooks/              # Custom hooks
├── services/           # API services
├── utils/              # Utility functions
├── context/            # React context providers
├── store/              # State management
├── types/              # TypeScript type definitions
└── constants/          # App constants
```

---

## Troubleshooting Guide

### Common Metro Bundler Issues

```bash
# Clear Metro cache
npx react-native start --reset-cache

# Clear node modules
rm -rf node_modules
npm install

# Clear watchman cache (macOS/Linux)
watchman watch-del-all

# Reset iOS simulator
xcrun simctl erase all

# Clean Android build
cd android && ./gradlew clean
```

### Build Issues

```bash
# iOS build issues
cd ios && pod install
npx react-native run-ios --clean

# Android build issues
cd android && ./gradlew clean
npx react-native run-android --clean

# Check React Native doctor
npx react-native doctor
```

### Common Runtime Errors

**"Unable to resolve module":**
- Check import paths
- Ensure module is installed
- Clear Metro cache

**"Native module cannot be null":**
- Link native dependencies (if using React Native < 0.60)
- Rebuild the app after installing native modules

**"Network request failed":**
- Check network connectivity
- Verify API endpoints
- Handle network errors in code

### Performance Issues

**Slow FlatList scrolling:**
- Use `getItemLayout` if items have fixed height
- Implement `keyExtractor` properly
- Reduce item complexity
- Use `removeClippedSubviews`

**Memory leaks:**
- Clean up subscriptions in useEffect
- Remove event listeners
- Avoid storing large objects in state

---

## API Reference

### Core Components Quick Reference

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `View` | Container component | `style`, `pointerEvents` |
| `Text` | Display text | `numberOfLines`, `ellipsizeMode` |
| `Image` | Display images | `source`, `resizeMode` |
| `ScrollView` | Scrollable container | `horizontal`, `showsScrollIndicator` |
| `FlatList` | Performance list | `data`, `renderItem`, `keyExtractor` |
| `TextInput` | Text input | `value`, `onChangeText`, `placeholder` |
| `TouchableOpacity` | Touchable with opacity | `onPress`, `activeOpacity` |
| `Modal` | Modal overlay | `visible`, `animationType` |

### Styling Properties

```typescript
interface ViewStyle {
  // Layout
  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  
  // Dimensions
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  
  // Spacing
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  
  // Background
  backgroundColor?: string;
  
  // Border
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  
  // Position
  position?: 'absolute' | 'relative';
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  
  // Shadow (iOS)
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  
  // Elevation (Android)
  elevation?: number;
}
```

### Navigation API

```typescript
// Navigation prop methods
navigation.navigate('ScreenName', { param: 'value' });
navigation.push('ScreenName');
navigation.goBack();
navigation.popToTop();
navigation.reset({
  index: 0,
  routes: [{ name: 'Home' }],
});

// Route prop
route.params; // Parameters passed to screen
route.name;   // Screen name

// Navigation options
navigation.setOptions({
  title: 'New Title',
  headerShown: false,
  gestureEnabled: true,
});
```

---

## SnapConnect-Specific Patterns

### Gradient Integration

```typescript
// Using SnapConnect gradient system
import { GradientCard } from '@/components/ui/GradientCard';
import { gradients } from '@/styles/gradients';

const FitnessCard = ({ workoutType, onPress }) => (
  <GradientCard 
    gradient={workoutType} // 'cardio', 'strength', 'flexibility'
    onPress={onPress}
    className="mx-4 mb-4"
  >
    <Text className="text-white font-bold text-lg">
      {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout
    </Text>
  </GradientCard>
);
```

### Camera Integration

```typescript
import { Camera } from 'expo-camera';

const CameraScreen = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState(Camera.Constants.Type.back);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera style={{ flex: 1 }} type={type}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setType(
                type === Camera.Constants.Type.back
                  ? Camera.Constants.Type.front
                  : Camera.Constants.Type.back
              );
            }}>
            <Text style={styles.text}>Flip</Text>
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
};
```

---

*This documentation serves as a comprehensive guide for AI assistants developing React Native applications for SnapConnect. Always refer to the official React Native documentation at https://reactnative.dev for the most up-to-date information.*

**Last Updated:** June 23, 2025  
**React Native Version:** 0.79.4  
**Target Platforms:** iOS 14+, Android API 30+