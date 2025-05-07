import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import { prepare, SemanticContext } from '../sr-prepare';
import { buildPackage } from '../sr-build-package';
import { deployContracts } from '../deploy-contracts';
import { verifyContracts } from '../verify-contracts';

// Mock dependencies
jest.mock('../sr-build-package', () => ({
  buildPackage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../deploy-contracts', () => ({
  deployContracts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../verify-contracts', () => ({
  verifyContracts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../helpers', () => ({
  loadChainData: jest.fn().mockResolvedValue({
    '1': { name: 'Ethereum', testnet: false },
    '11155111': { name: 'Sepolia', testnet: true },
    '137': { name: 'Polygon', testnet: false },
    '80001': { name: 'Mumbai', testnet: true },
  }),
}));

describe('prepare', () => {
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

  it('should execute the prepare phase for testnet by default', async () => {
    await prepare({}, context);
    
    expect(buildPackage).toHaveBeenCalledWith({}, context);
    expect(deployContracts).toHaveBeenCalledWith(
      context,
      ['11155111', '80001'], // Only testnet chains
      expect.any(Object)
    );
    expect(verifyContracts).toHaveBeenCalledWith(context);
  });

  it('should execute the prepare phase for mainnet when specified', async () => {
    process.env.DEPLOY_ENVIRONMENT = 'mainnet';
    
    await prepare({}, context);
    
    expect(buildPackage).toHaveBeenCalledWith({}, context);
    expect(deployContracts).toHaveBeenCalledWith(
      context,
      ['1', '137'], // Only mainnet chains
      expect.any(Object)
    );
    expect(verifyContracts).toHaveBeenCalledWith(context);
    
    delete process.env.DEPLOY_ENVIRONMENT;
  });

  it('should handle errors during preparation', async () => {
    (buildPackage as jest.Mock).mockRejectedValueOnce(new Error('Build failed'));
    
    await expect(prepare({}, context)).rejects.toThrow('Build failed');
    
    expect(context.logger.error).not.toHaveBeenCalled(); // Error is thrown, not logged
    expect(deployContracts).not.toHaveBeenCalled(); // Deployment should not happen if build fails
  });
});