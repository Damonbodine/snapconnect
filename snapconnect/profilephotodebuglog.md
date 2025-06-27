# Profile Photo Upload Debugging Log

## Overview
This document tracks all issues, attempts, and solutions for the avatar/profile photo upload functionality in SnapConnect. The goal is to successfully upload profile photos to Supabase Storage from React Native.

---

## 🚨 Current Issue: 0KB Files Still Being Created

### Issue Details
**Date:** June 24, 2025  
**Status:** 🔄 In Progress  
**Error:** Files upload to Supabase but show as 0KB

### Timeline of Attempts

#### Attempt #1: FormData with Blob
**Status:** ❌ Failed  
**Implementation:**
```javascript
const formData = new FormData();
formData.append('file', { uri, name, type });
// Direct upload with fetch
```
**Result:** 0KB files  
**Learning:** FormData doesn't work properly with React Native + Supabase

#### Attempt #2: Following Supabase Docs with FileSystem + base64
**Status:** ❌ Failed  
**Implementation:**
```javascript
const base64 = await FileSystem.readAsStringAsync(uri, { 
  encoding: FileSystem.EncodingType.Base64 
});
// decode function using atob
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(fileName, decode(base64))
```
**Result:** Still 0KB files  
**Hypothesis:** `atob` function might not exist in React Native environment

### Current Investigation
1. `atob` is a browser API that doesn't exist in React Native
2. Need to use a React Native compatible base64 decoder
3. Alternative approaches to investigate

#### Attempt #3: Using base64-arraybuffer library
**Status:** ❌ Failed  
**Implementation:**
```javascript
import { decode } from 'base64-arraybuffer';
// Rest of code remains the same
```
**Result:** Still getting 403 policy errors
**Learning:** The issue might be with storage policies, not the upload method

### New Discovery: 403 Policy Error Persists
**Error:** `"new row violates row-level security policy"`
**Analysis:** 
- The simplified policies weren't being applied correctly
- Storage policies were eventually fixed
- The 0KB issue persisted even after fixing policies

#### Attempt #4: ArrayBuffer to Blob Conversion
**Status:** ✅ SUCCESS!  
**Implementation:**
```javascript
// Convert ArrayBuffer to Blob before upload
const blob = new Blob([arrayBuffer], { type: `image/${fileExt}` });
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(fileName, blob, {
    contentType: `image/${fileExt}`,
    upsert: true
  });
```
**Result:** Files upload with correct size and display properly!
**Key Learning:** Supabase Storage expects a Blob, not raw ArrayBuffer

### ✅ SOLUTION FOUND
The working approach:
1. Read file as base64 using FileSystem.readAsStringAsync
2. Decode base64 to ArrayBuffer using base64-arraybuffer library
3. **Convert ArrayBuffer to Blob** (this was the missing step!)
4. Upload Blob to Supabase Storage

Also fixed deprecation warning by using `mediaTypes: 'images'` instead of `ImagePicker.MediaTypeOptions.Images`

### ⚠️ New Issue: Blob Creation Error
**Date:** June 24, 2025  
**Error:** `Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported`
**Context:** Happens with larger images (~1MB)
**Status:** 🔄 In Progress

---

## 📋 Environment Details
- React Native: 0.79.4
- Expo SDK: 53.0.12
- Supabase JS: 2.50.0
- expo-file-system: 18.1.10
- expo-image-picker: 16.1.4

---

## 🔍 Next Steps to Try
1. ✅ Replace `atob` with React Native compatible decoder (base64-arraybuffer)
2. Add logging to verify base64 and ArrayBuffer sizes
3. Try alternative: Upload as Blob using FileSystem.uploadAsync
4. Test with different image formats (jpg vs png)
5. Try uploading without base64 conversion (direct blob)
6. Check Supabase client version compatibility

---

## 📚 Resources
- [Supabase React Native Storage Blog](https://supabase.com/blog/react-native-storage)
- [Expo FileSystem Docs](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [React Native Image Handling](https://reactnative.dev/docs/images)