# Friends System Implementation Guide

## 🎯 **Context & Current Status**

### ✅ **What's Already Working**
- **Ephemeral discover feed** - Posts auto-disappear after 10 seconds when viewed
- **User profile navigation** - Click on any post → navigate to user's profile
- **Real authenticated test users** with complete profiles
- **Database schema** - friendships table already exists and ready
- **Profile screen** - Shows user info with "Add Friend" button (currently placeholder)

### 🔧 **Technical Foundation Ready**
- **Supabase backend** with Row Level Security configured
- **React Native + Expo Router** navigation working
- **Zustand state management** pattern established
- **TypeScript strict mode** enabled
- **Test users** created with realistic data

---

## 📊 **Database Schema (Already Implemented)**

### **Friendships Table**
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

### **Users Table** (For Reference)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT[] DEFAULT '{}',
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Required RLS Policies** (Already Applied)
```sql
-- Allow users to view other users' profiles
CREATE POLICY "Users can view other users' profiles" ON users
  FOR SELECT USING (true);

-- Add these for friendships (NEED TO IMPLEMENT)
CREATE POLICY "Users can view their friendships" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can manage their friendships" ON friendships
  FOR ALL USING (auth.uid() = user_id);
```

---

## 🧪 **Test Users Available**

### **Real Authenticated Accounts** (Password: `testpass123`)
```
Email: alex.fitness@test.com    → @fitness_guru_real (Advanced)
Email: sarah.yoga@test.com      → @yoga_master_real (Intermediate)  
Email: emma.strong@test.com     → @strong_emma_real (Advanced)
Email: mike.runner@test.com     → @runner_mike_real (Beginner)
Email: david.zen@test.com       → @zen_master_real (Intermediate)
Email: lisa.beginner@test.com   → @newbie_lisa_real (Beginner)
```

### **User IDs for Testing**
```typescript
const TEST_USER_IDS = {
  fitness_guru_real: 'b7e9d57a-c592-45ed-b737-427d7d1c1f9f',
  yoga_master_real: '5225b7d4-c0e1-4ef2-8001-b053d677052a',
  strong_emma_real: 'ca764f17-9dcf-4672-83f0-c72a13566c75',
  runner_mike_real: '056743f6-9344-40af-bc2b-99e8c286d056',
  zen_master_real: '68466a50-c876-4bd3-8a06-c51f6a2289c4',
  newbie_lisa_real: '4ed256f2-b1a5-4424-be44-c3447b952cf8'
};
```

---

## 🏗️ **Implementation Plan**

### **Phase 1: Core Friend Service** (High Priority)
```typescript
// File: src/services/friendService.ts
interface FriendService {
  sendFriendRequest(friendId: string): Promise<void>;
  acceptFriendRequest(friendshipId: string): Promise<void>;
  declineFriendRequest(friendshipId: string): Promise<void>;
  removeFriend(friendId: string): Promise<void>;
  getFriends(): Promise<UserProfile[]>;
  getPendingRequests(): Promise<FriendRequest[]>;
  getSentRequests(): Promise<FriendRequest[]>;
  getFriendshipStatus(friendId: string): Promise<FriendshipStatus>;
}
```

### **Phase 2: State Management** (High Priority)
```typescript
// File: src/stores/friendsStore.ts
interface FriendsStore {
  friends: UserProfile[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  isLoading: boolean;
  
  // Actions
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
}
```

### **Phase 3: UI Components** (Medium Priority)
1. **Update Profile Screen** - Wire up "Add Friend" button
2. **Friends List Screen** - View all friends
3. **Friend Requests Screen** - Manage pending requests
4. **Friend Status Components** - Show friendship status

### **Phase 4: Real-time Features** (Low Priority)
1. **Push notifications** for friend requests
2. **Badge counts** for pending requests
3. **Real-time status updates**

---

## 📁 **Key Files to Modify**

### **Current Profile Screen** (READY TO WIRE UP)
```typescript
// File: app/user/[userId].tsx
// Line ~105: Contains placeholder "Add Friend" button
const handleAddFriend = () => {
  Alert.alert('Coming Soon', 'Friend requests will be implemented next!');
};

// REPLACE WITH: Actual friend request logic
```

### **Existing Navigation Structure**
```
app/
├── (tabs)/
│   ├── discover.tsx      ← Working discover feed
│   ├── profile.tsx       ← Your own profile
│   └── _layout.tsx       ← Tab navigation
├── user/
│   └── [userId].tsx      ← Other users' profiles (ADD FRIEND BUTTON HERE)
└── _layout.tsx
```

### **State Management Pattern** (Follow Existing)
```typescript
// Example from: src/stores/discoverStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFriendsStore = create<FriendsStore>()(
  persist(
    (set, get) => ({
      // State and actions here
    }),
    {
      name: 'friends-storage',
      // Persist friendship data
    }
  )
);
```

---

## 🔧 **Implementation Details**

### **Friend Request Flow**
```
1. User A clicks "Add Friend" on User B's profile
2. Creates friendship record: { user_id: A, friend_id: B, status: 'pending' }
3. User B sees pending request in their requests list
4. User B accepts/declines:
   - Accept: Update status to 'accepted'
   - Decline: Delete record OR set status to 'declined'
5. Both users can now see each other in friends list
```

### **Database Queries Needed**
```sql
-- Send friend request
INSERT INTO friendships (user_id, friend_id, status) 
VALUES ($1, $2, 'pending');

-- Accept friend request  
UPDATE friendships 
SET status = 'accepted' 
WHERE id = $1 AND friend_id = $2;

-- Get friends list
SELECT u.* FROM users u
JOIN friendships f ON (u.id = f.friend_id OR u.id = f.user_id)
WHERE (f.user_id = $1 OR f.friend_id = $1) 
  AND f.status = 'accepted'
  AND u.id != $1;

-- Get pending requests received
SELECT u.*, f.id as friendship_id FROM users u
JOIN friendships f ON u.id = f.user_id
WHERE f.friend_id = $1 AND f.status = 'pending';

-- Check friendship status
SELECT status FROM friendships 
WHERE (user_id = $1 AND friend_id = $2) 
   OR (user_id = $2 AND friend_id = $1);
```

### **Button States to Handle**
```typescript
type FriendButtonState = 
  | 'add_friend'        // Can send request
  | 'request_sent'      // Request pending (sent by you)
  | 'accept_request'    // Request pending (sent to you)  
  | 'friends'           // Already friends
  | 'yourself'          // Viewing own profile
  | 'blocked';          // User blocked
```

---

## 🎨 **UI Components to Create**

### **Friend Request Button Component**
```typescript
// File: src/components/friends/FriendButton.tsx
interface FriendButtonProps {
  userId: string;
  currentUserId: string;
  onStatusChange?: () => void;
}

// Handles all button states and logic
```

### **Friends List Component**
```typescript
// File: src/components/friends/FriendsList.tsx
// Shows grid/list of user's friends with avatars
```

### **Pending Requests Component**
```typescript
// File: src/components/friends/PendingRequests.tsx  
// Shows incoming friend requests with accept/decline options
```

### **Friends Screen**
```typescript
// File: app/(tabs)/friends.tsx OR app/friends/index.tsx
// Main friends management screen
```

---

## 🧪 **Testing Strategy**

### **Manual Testing Flow**
1. **Login as alex.fitness@test.com**
2. **Navigate to @yoga_master_real profile**
3. **Click "Add Friend"** → Should send request
4. **Login as sarah.yoga@test.com** 
5. **Check pending requests** → Should see request from Alex
6. **Accept request** → Both should be friends
7. **Verify friends list** → Both should see each other

### **Test Scenarios**
```typescript
// Test all friendship states
const testScenarios = [
  'Send friend request to new user',
  'Accept incoming friend request', 
  'Decline incoming friend request',
  'Cancel sent friend request',
  'Remove existing friend',
  'Block user',
  'View friends list',
  'View pending requests'
];
```

---

## 🚨 **Important Notes**

### **Supabase Configuration**
- **Project ID**: `lubfyjzdfgpoocsswrkz`
- **Service Role Key**: Available (for admin operations)
- **Anon Key**: Used by app (check .env files)

### **Current User Context**
- **Your user ID**: `2f06a32c-7148-4d24-9af5-63f1ea4cd79a` (from logs)
- **Username**: `@test`
- **Can navigate to profiles**: ✅ Working
- **Can view profile data**: ✅ Working

### **Ephemeral System Context**
- **Discover posts disappear** after 10 seconds when viewed
- **Test profile posts** are NON-ephemeral (won't disappear)
- **Profile navigation works** from any post in discover feed

### **Performance Considerations**
- **Cache friends list** in Zustand store
- **Optimistic updates** for better UX
- **Batch friend status checks** when viewing multiple profiles
- **Real-time subscriptions** for friend requests (future enhancement)

---

## 🎯 **Success Criteria**

### **Minimum Viable Product**
- ✅ Send friend requests from profile screen
- ✅ Accept/decline friend requests  
- ✅ View friends list
- ✅ Remove friends
- ✅ Proper button states (pending, friends, etc.)

### **Enhanced Features** (Future)
- 🔔 Push notifications for requests
- 🎯 Friend suggestions based on mutual friends
- 📊 Friend activity feeds
- 🔍 Search for friends by username
- 👥 Mutual friends display

---

## 🚀 **Getting Started**

### **Immediate Next Steps**
1. **Create RLS policies** for friendships table
2. **Implement FriendService.ts** with core database operations
3. **Create FriendsStore.ts** with Zustand state management
4. **Wire up "Add Friend" button** in `/app/user/[userId].tsx`
5. **Test with existing test users**

### **Quick Win**
Start with the **Add Friend button** on the profile screen. This gives immediate visual feedback and tests the core friend request flow.

**All the infrastructure is ready - just need to implement the logic!** 🎉

---

**Last Updated**: June 24, 2025  
**Context**: Profile navigation working, ready for friends implementation  
**Test Users**: 6 real authenticated accounts available  
**Database**: Schema ready, RLS policies need completion