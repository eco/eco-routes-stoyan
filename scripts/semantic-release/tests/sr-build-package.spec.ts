import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { buildPackage } from '../sr-build-package';
import { SemanticContext } from '../sr-prepare';
import fs from 'fs';
import childProcess from 'child_process';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('buildPackage', () => {
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

  it('should build the package successfully', async () => {
    await buildPackage({}, context);
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Building package')
    );
    
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining('yarn run build'),
      expect.any(Object)
    );
    
    expect(context.logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Package built successfully')
    );
  });

  it('should handle build failures', async () => {
    (childProcess.execSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Build failed');
    });
    
    await expect(buildPackage({}, context)).rejects.toThrow('Failed to build package');
    
    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error building package:')
    );
  });
});