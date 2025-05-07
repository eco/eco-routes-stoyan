import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { deployContracts } from '../deploy-contracts';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    '1': 'API_KEY_1',
    '137': 'API_KEY_137',
  })),
  writeFileSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('Deployment successful')),
}));

describe('deployContracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRIVATE_KEY = 'test_private_key';
    process.env.ALCHEMY_API_KEY = 'test_alchemy_key';
  });

  it('should deploy contracts to specified chains', async () => {
    const context = {
      logger: { log: jest.fn(), error: jest.fn() },
      nextRelease: { version: '1.0.0' },
      cwd: '/test/path',
    };

    await deployContracts(context, ['1', '137']);

    // Check that logger was called correctly
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Deploying contracts to chains: 1,137')
    );

    // Verify environment setup and execution
    const { execSync } = require('child_process');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringMatching(/\.\/(MultiDeploy\.sh|scripts\/MultiDeploy\.sh)/),
      expect.objectContaining({
        env: expect.objectContaining({
          PRIVATE_KEY: 'test_private_key',
          ALCHEMY_API_KEY: 'test_alchemy_key',
          VERIFICATION_KEYS: expect.any(String),
        }),
      })
    );
  });

  it('should handle deployment failures', async () => {
    const { execSync } = require('child_process');
    execSync.mockImplementationOnce(() => {
      throw new Error('Deployment failed');
    });

    const context = {
      logger: { log: jest.fn(), error: jest.fn() },
      nextRelease: { version: '1.0.0' },
      cwd: '/test/path',
    };

    await expect(deployContracts(context, ['1'])).rejects.toThrow();

    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error deploying contracts')
    );
  });
});