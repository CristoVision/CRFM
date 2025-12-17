// src/contexts/authContext/authService.js
import { supabase } from '@/lib/supabaseClient';

/**
 * -----------------------------
 * Auth Core
 * -----------------------------
 */

/**
 * Email + Password Login
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loginUser(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Logout
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Register user (optionally with avatar upload)
 * NOTE: We return the created user and a public avatarUrl so your AuthContext
 *       can upsert the profile right after a successful signup.
 *
 * @returns {Promise<{success: boolean, user?: any, avatarUrl?: string, error?: string}>}
 */
export async function registerUser(email, password, nameParts, avatarFile) {
  // Where Supabase should redirect after email confirmation / magic link handoff.
  // We'll land on /auth and exchange the code there.
  const emailRedirectTo = `${window.location.origin}/auth`;

  const firstName = (nameParts?.first_name ?? '').toString().trim();
  const middleName = (nameParts?.middle_name ?? '').toString().trim();
  const lastName = (nameParts?.last_name ?? '').toString().trim();
  const secondLastName = (nameParts?.second_last_name ?? '').toString().trim();
  const fullName = [firstName, middleName, lastName, secondLastName].filter(Boolean).join(' ').trim();

  // 1) Sign up
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName ?? '',
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        second_last_name: secondLastName,
      }, // stored in auth.user_metadata too (used by profiles trigger)
      emailRedirectTo,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const { user } = data ?? {};
  if (!user) {
    // Extremely rare, but handle defensively
    return { success: true, user: null, avatarUrl: undefined };
  }

  // 2) If avatar provided, upload to storage and return the public URL
  let avatarUrl;
  if (avatarFile) {
    const uploadRes = await uploadAvatarForUser(user.id, avatarFile);
    if (uploadRes.success) {
      avatarUrl = uploadRes.publicUrl;
    } else {
      // Not fatal for signup; surface as part of the response if you want
      console.warn('Avatar upload failed:', uploadRes.error);
    }
  }

  return { success: true, user, avatarUrl };
}

/**
 * -----------------------------
 * Password Reset Flow
 * -----------------------------
 */

/**
 * Send password reset email.
 * IMPORTANT: redirectTo must point at your ResetPassword route
 * so the recovery session can be exchanged and the user can set a new password.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPasswordResetEmailProvider(email) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Update the password for the current (recovery) session.
 * This is called from ResetPasswordScreen **after** we've exchanged the recovery link
 * (via supabase.auth.exchangeCodeForSession in the UI layer).
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateUserPasswordProvider(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * -----------------------------
 * Helpers
 * -----------------------------
 */

/**
 * Upload avatar to the "avatars" storage bucket and return a public URL.
 *
 * @returns {Promise<{success: boolean, publicUrl?: string, error?: string}>}
 */
async function uploadAvatarForUser(userId, file) {
  try {
    const ext = getFileExtension(file?.name) || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = pub?.publicUrl;

    if (!publicUrl) {
      return { success: false, error: 'Could not generate public URL for avatar.' };
    }

    return { success: true, publicUrl };
  } catch (e) {
    return { success: false, error: e.message || 'Avatar upload failed' };
  }
}

function getFileExtension(name = '') {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}
