import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { version } from '../sr-version';
import { SemanticContext } from '../sr-prepare';
import { updateVersionInSolidityFiles } from '../solidity-version-updater';

jest.mock('../solidity-version-updater', () => ({
  updateVersionInSolidityFiles: jest.fn().mockResolvedValue(['contracts/libs/Semver.sol']),
}));

describe('version', () => {
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
  });

  it('should update version in Solidity files', async () => {
    await version({}, context);
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Updating version in files to 1.0.0')
    );
    
    expect(updateVersionInSolidityFiles).toHaveBeenCalledWith(
      '1.0.0',
      expect.any(Object)
    );
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Updated version in 1 Solidity files')
    );
  });

  it('should handle version update failures', async () => {
    (updateVersionInSolidityFiles as jest.Mock).mockRejectedValueOnce(
      new Error('Version update failed')
    );
    
    await expect(version({}, context)).rejects.toThrow('Failed to update version in files');
    
    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error updating version in files:')
    );
  });
});