import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { loadChainData, loadVerificationKeys, formatVerificationKeys } from '../helpers';
import fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.CHAIN_DATA_URL;
    delete process.env.CONTRACT_VERIFICATION_KEYS;
  });

  describe('loadChainData', () => {
    it('should load chain data from URL if provided', async () => {
      process.env.CHAIN_DATA_URL = 'https://example.com/chains.json';
      
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          '1': { name: 'Ethereum', rpc: 'https://eth.example.com' },
          '137': { name: 'Polygon', rpc: 'https://polygon.example.com' }
        })
      }) as any;

      const result = await loadChainData();
      
      expect(fetch).toHaveBeenCalledWith('https://example.com/chains.json');
      expect(result).toEqual({
        '1': { name: 'Ethereum', rpc: 'https://eth.example.com' },
        '137': { name: 'Polygon', rpc: 'https://polygon.example.com' }
      });
    });

    it('should return default chain data if no URL provided', async () => {
      const result = await loadChainData();
      
      // Check that we have at least some common chains
      expect(result).toHaveProperty('1');
      expect(result).toHaveProperty('137');
      expect(result).toHaveProperty('42161');
    });
  });

  describe('loadVerificationKeys', () => {
    it('should load verification keys from environment variable', () => {
      process.env.CONTRACT_VERIFICATION_KEYS = JSON.stringify({
        '1': 'KEY1',
        '137': 'KEY137'
      });
      
      const result = loadVerificationKeys();
      
      expect(result).toEqual({
        '1': 'KEY1',
        '137': 'KEY137'
      });
    });

    it('should load verification keys from file if env variable not set', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        '1': 'FILE_KEY1',
        '137': 'FILE_KEY137'
      }));
      
      const result = loadVerificationKeys();
      
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('verification-keys.json'),
        'utf8'
      );
      expect(result).toEqual({
        '1': 'FILE_KEY1',
        '137': 'FILE_KEY137'
      });
    });

    it('should return empty object if keys not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = loadVerificationKeys();
      
      expect(result).toEqual({});
    });
  });

  describe('formatVerificationKeys', () => {
    it('should format verification keys for environment', () => {
      const keys = {
        '1': 'KEY1',
        '137': 'KEY137'
      };
      
      const result = formatVerificationKeys(keys);
      
      expect(result).toBe(JSON.stringify(keys));
    });
  });
});