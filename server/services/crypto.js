import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync, createHash } from 'crypto';
import { execSync } from 'child_process';
import { platform } from 'os';

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

// In-memory master key (cleared on lock/restart)
let masterKey = null;

export function deriveKey(password, salt) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

export function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const hash = deriveKey(password, salt);
  return {
    hash: hash.toString('base64'),
    salt: salt.toString('base64'),
  };
}

export function verifyPassword(password, storedHash, storedSalt) {
  const salt = Buffer.from(storedSalt, 'base64');
  const hash = deriveKey(password, salt);
  return hash.toString('base64') === storedHash;
}

export function encrypt(plaintext) {
  if (!masterKey) throw new Error('Master key no desbloqueada');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: authTag.toString('base64'),
  });
}

export function decrypt(encryptedJson) {
  if (!masterKey) throw new Error('Master key no desbloqueada');
  const { iv, data, tag } = JSON.parse(encryptedJson);
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function setupMasterKey(password, salt) {
  masterKey = deriveKey(password, Buffer.from(salt, 'base64'));
}

export function unlockWithPassword(password, storedSalt) {
  masterKey = deriveKey(password, Buffer.from(storedSalt, 'base64'));
}

export function lockMasterKey() {
  masterKey = null;
}

export function isUnlocked() {
  return masterKey !== null;
}

// macOS Keychain integration
export function isKeychainAvailable() {
  return platform() === 'darwin';
}

export function getFromKeychain() {
  if (!isKeychainAvailable()) return null;
  try {
    const result = execSync('security find-generic-password -s "kodo-master-key" -w 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    });
    return result.trim();
  } catch {
    return null;
  }
}

export function setInKeychain(password) {
  if (!isKeychainAvailable()) return false;
  try {
    // Try update first, then add
    try {
      execSync(`security add-generic-password -U -s "kodo-master-key" -a "kodo" -w "${password.replace(/"/g, '\\"')}"`, {
        timeout: 5000,
      });
    } catch {
      execSync(`security add-generic-password -s "kodo-master-key" -a "kodo" -w "${password.replace(/"/g, '\\"')}"`, {
        timeout: 5000,
      });
    }
    return true;
  } catch {
    return false;
  }
}

export function deleteFromKeychain() {
  if (!isKeychainAvailable()) return;
  try {
    execSync('security delete-generic-password -s "kodo-master-key" 2>/dev/null', { timeout: 5000 });
  } catch {
    // already deleted or not found
  }
}
