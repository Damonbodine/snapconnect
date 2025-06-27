# iOS Google Maps Setup Instructions

To enable accurate Google Maps walking routes on iOS, you need to configure the Google Maps iOS SDK in your Xcode project.

## Required Steps

### 1. Open Xcode Project
```bash
cd ios
open SnapConnect.xcworkspace
```

### 2. Add Google Maps Framework
The react-native-maps library should already include the Google Maps framework. Verify it's listed in:
- **Target: SnapConnect** → **General** → **Frameworks, Libraries, and Embedded Content**
- Look for `GoogleMaps.framework` or similar

### 3. Update Info.plist
Add the following entries to `ios/SnapConnect/Info.plist`:

```xml
<key>GMSApiKey</key>
<string>AIzaSyC6dAzPTWAO62FQhgmA04ouk2mk12KhXXg</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to show your position on the map and generate personalized walking suggestions nearby.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to show your position on the map and generate personalized walking suggestions nearby.</string>
```

### 4. Configure App Transport Security
Add this to your Info.plist to allow map tile loading:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>googleapis.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
        <key>maps.googleapis.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>
```

### 5. Verify Podfile Configuration
Your `ios/Podfile` should already have the Google Maps configuration from react-native-maps. Verify these lines exist:

```ruby
# React Native Maps dependencies
rn_maps_path = '../node_modules/react-native-maps'
pod 'react-native-google-maps', :path => rn_maps_path
```

### 6. Clean and Rebuild
```bash
cd ios
rm -rf build
pod install
cd ..
npx react-native run-ios
```

## Verification

After setup, you should see:
1. Google Maps tiles loading instead of Apple Maps
2. More accurate walking routes that follow sidewalks and pedestrian paths
3. Better route accuracy with the new Routes API v2 implementation

## Troubleshooting

### Common Issues:

1. **"Google Maps API key not configured" error**
   - Verify the API key is correctly added to Info.plist
   - Ensure the API key has Maps SDK for iOS enabled in Google Cloud Console

2. **Map tiles not loading**
   - Check App Transport Security settings
   - Verify internet connectivity and API key quotas

3. **React Native Maps not using Google provider**
   - Ensure `provider={PROVIDER_GOOGLE}` is set in MapView components
   - Check that Google Maps framework is properly linked

4. **Walking routes still inaccurate**
   - Verify the Routes API v2 is being used (check console logs)
   - Ensure `avoidIndoor: true` modifier is applied

## API Usage

The updated implementation now uses:
- **Routes API v2** for more accurate walking directions
- **avoidIndoor: true** modifier to prefer outdoor paths
- **Fallback to legacy Directions API** if Routes API fails
- **Google Maps provider** for better map display and routing data

This should resolve the issue of walking routes going through backyards and private property.