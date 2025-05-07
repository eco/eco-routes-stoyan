import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { verifyConditions } from '../sr-verify-conditions';
import { SemanticContext } from '../sr-prepare';
import fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('verifyConditions', () => {
  let context: SemanticContext;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    context = {
      nextRelease: {
        version: '1.0.0',
        gitTag: 'v1.0.0',
        notes: 'Test release notes',
        type: 'minor',
      },
      logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      cwd: '/test/cwd',
    };

    // Default mock implementation for environment variables
    process.env.PRIVATE_KEY = 'test_private_key';
    process.env.ALCHEMY_API_KEY = 'test_alchemy_key';
    process.env.CONTRACT_VERIFICATION_KEYS = JSON.stringify({
      '1': 'KEY1',
      '137': 'KEY137',
    });

    // Mock file exists for verification keys file
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      '1': 'FILE_KEY1',
      '137': 'FILE_KEY137',
    }));
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.PRIVATE_KEY;
    delete process.env.ALCHEMY_API_KEY;
    delete process.env.CONTRACT_VERIFICATION_KEYS;
  });

  it('should verify conditions successfully with environment variables', async () => {
    await verifyConditions({}, context);
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Verifying release conditions')
    );
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('✓ Required environment variables are set')
    );
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('All conditions verified successfully')
    );
  });

  it('should verify conditions with verification keys file', async () => {
    delete process.env.CONTRACT_VERIFICATION_KEYS;
    
    await verifyConditions({}, context);
    
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('verification-keys.json')
    );
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('✓ Verification keys file found')
    );
  });

  it('should fail if private key is missing', async () => {
    delete process.env.PRIVATE_KEY;
    
    await expect(verifyConditions({}, context)).rejects.toThrow(
      'Missing required environment variable: PRIVATE_KEY'
    );
  });

  it('should fail if Alchemy API key is missing', async () => {
    delete process.env.ALCHEMY_API_KEY;
    
    await expect(verifyConditions({}, context)).rejects.toThrow(
      'Missing required environment variable: ALCHEMY_API_KEY'
    );
  });

  it('should fail if verification keys are missing', async () => {
    delete process.env.CONTRACT_VERIFICATION_KEYS;
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await expect(verifyConditions({}, context)).rejects.toThrow(
      'Missing verification keys'
    );
  });
});