/**
 * Production Tauri API wrapper - No mock data, Tauri only
 * This is a production-ready implementation that requires Tauri environment
 */

// Type definitions for Tauri API compatibility
export interface TauriInvokeOptions {
  [key: string]: any;
}

// Extend Window interface to include Tauri
declare global {
  interface Window {
    __TAURI__?: {
      core?: any;
      fs?: any;
      shell?: any;
      dialog?: any;
      notification?: any;
    };
  }
}

/**
 * Check if we're running in a Tauri environment
 */
export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // In development mode (localhost), assume Tauri is available
  if (window.location.hostname === 'localhost') {
    console.log('[TauriAPI] Development mode detected, assuming Tauri environment');
    return true;
  }
  
  // In production, check for Tauri protocol or file:// protocol (desktop app)
  if (window.location.protocol === 'tauri:' || window.location.protocol === 'file:') {
    console.log('[TauriAPI] Production Tauri environment detected');
    return true;
  }
  
  // Check for Tauri API availability
  try {
    const hasTauri = window.__TAURI__ !== undefined || 
                     (window as any).__TAURI_INTERNALS__ !== undefined ||
                     typeof (window as any).__TAURI_INVOKE__ === 'function';
    
    if (hasTauri) {
      console.log('[TauriAPI] Tauri APIs detected');
    } else {
      console.log('[TauriAPI] No Tauri APIs found');
    }
    
    return hasTauri;
  } catch (error) {
    console.error('[TauriAPI] Error checking Tauri environment:', error);
    return false;
  }
};

/**
 * Check if Tauri APIs are available
 */
export const isTauriAvailable = (): boolean => {
  return isTauriEnvironment();
};

/**
 * Throw error if not in Tauri environment
 */
const ensureTauriEnvironment = () => {
  if (!isTauriEnvironment()) {
    throw new Error('This application requires Tauri environment. Please run in desktop mode.');
  }
};

/**
 * Production Tauri invoke wrapper - Tauri environment required
 */
export const safeTauriInvoke = async <T = any>(
  command: string, 
  args?: TauriInvokeOptions
): Promise<T> => {
  console.log('[TauriAPI] Invoking command:', command, 'with args:', args);
  
  // Ensure we're in Tauri environment
  ensureTauriEnvironment();
  
  try {
    // Use dynamic import to avoid build-time errors
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<T>(command, args);
    console.log('[TauriAPI] Command', command, 'completed successfully');
    return result;
  } catch (error) {
    console.error('[TauriAPI] Command', command, 'failed:', error);
    throw error;
  }
};


/**
 * Production USB Drive Operations
 */
export const resetUsbDrive = async (devicePath: string): Promise<void> => {
  ensureTauriEnvironment();
  return safeTauriInvoke('reset_usb_drive', { devicePath });
};

export const getUsbDrivePassword = async (userId: string, driveId: string): Promise<string | null> => {
  console.log('🔐 Getting USB drive password for user:', userId, 'drive:', driveId);
  
  ensureTauriEnvironment();
  
  try {
    const result = await safeTauriInvoke<string | null>('get_usb_drive_password', { 
      user_id: userId,
      drive_id: driveId 
    });
    console.log('[TauriAPI] USB drive password retrieved:', result ? 'Success' : 'Not found');
    return result;
  } catch (error) {
    console.error('[TauriAPI] Failed to get USB drive password:', error);
    return null;
  }
};

export const getCurrentStoredPassword = async (userId: string, driveId: string): Promise<string | null> => {
  return getUsbDrivePassword(userId, driveId);
};

export const setUsbDrivePassword = async (driveId: string, password: string): Promise<void> => {
  return safeTauriInvoke('save_usb_drive_password', { 
    user_id: 'default_user',
    request: {
      drive_id: driveId,
      device_path: `/dev/${driveId}`,
      drive_label: null,
      password,
      password_hint: null
    }
  });
};

export const checkTauriFeature = (feature: string): boolean => {
  if (!isTauriEnvironment()) {
    throw new Error('Tauri environment required');
  }
  
  try {
    if (!window.__TAURI__) {
      return false;
    }
    switch (feature) {
      case 'filesystem':
        return window.__TAURI__.fs !== undefined;
      case 'shell':
        return window.__TAURI__.shell !== undefined;
      case 'dialog':
        return window.__TAURI__.dialog !== undefined;
      case 'notification':
        return window.__TAURI__.notification !== undefined;
      default:
        return false;
    }
  } catch {
    return false;
  }
};

/**
 * Set USB drive trust level
 */
export const setDriveTrust = async (driveId: string, trustLevel: string): Promise<string> => {
  ensureTauriEnvironment();
  return await safeTauriInvoke<string>('set_drive_trust', { 
    driveId: driveId,
    trustLevel: trustLevel 
  });
};

/**
 * Get environment info for debugging - Production version
 */
export const getEnvironmentInfo = () => {
  ensureTauriEnvironment();
  
  return {
    isTauri: true,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Tauri Desktop',
    features: {
      filesystem: checkTauriFeature('filesystem'),
      shell: checkTauriFeature('shell'),
      dialog: checkTauriFeature('dialog'),
      notification: checkTauriFeature('notification')
    }
  };
};

// Export commonly used patterns
export default {
  invoke: safeTauriInvoke,
  isTauri: isTauriEnvironment,
  checkFeature: checkTauriFeature,
  getEnvironmentInfo
};
