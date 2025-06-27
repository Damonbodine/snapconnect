# Changelog

## Version 0.1.0 - 2025-06-25

### Changes

- **Refactored `authStore`:**
  - Simplified the `createProfile` method to use `upsert` instead of separate `insert` and `update` calls.
  - Reduced code duplication in the `signIn` and `signUp` methods by creating a `setUserAndSession` helper function.

### Rollback Instructions

If you experience any issues with these changes, you can roll them back by following these steps:

1. Open your terminal and navigate to the `snapconnect` directory.
2. Run the following command to restore the `authStore.ts` file to its previous state:

   ```bash
   git checkout HEAD -- src/stores/authStore.ts
   ```

This will discard the changes I made and restore the file to the version from the last commit.