import { useAuthStore } from './authStore';

describe('authStore', () => {
  it('should sign in and out correctly', async () => {
    const { signIn, signOut, user } = useAuthStore.getState();

    // Sign in
    await signIn('test@example.com', 'password');
    expect(user).not.toBeNull();

    // Sign out
    await signOut();
    expect(user).toBeNull();
  });
});