import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { publish } from '../sr-publish';
import { SemanticContext } from '../sr-prepare';
import childProcess from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('publish', () => {
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

  it('should publish the package successfully', async () => {
    const result = await publish({}, context);
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Publishing npm package')
    );
    
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm publish'),
      expect.any(Object)
    );
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Package published successfully')
    );
    
    expect(result).toBeUndefined();
  });

  it('should handle publish failures', async () => {
    (childProcess.execSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Publish failed');
    });
    
    await expect(publish({}, context)).rejects.toThrow('Failed to publish package');
    
    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error publishing package:')
    );
  });
});