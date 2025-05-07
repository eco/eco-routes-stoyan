import { expect, jest, describe, it, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { getAssets } from '../assets/utils';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('getAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      'TestContract': {
        'address': '0x123',
        'chain': '1',
      },
    }));
  });

  it('should get assets from deployAddresses.json', async () => {
    const result = await getAssets();
    
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('build', 'deployAddresses.json'))
    );
    expect(result).toEqual({
      'TestContract': {
        'address': '0x123',
        'chain': '1',
      },
    });
  });

  it('should return empty object if file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    const result = await getAssets();
    
    expect(result).toEqual({});
  });

  it('should handle invalid JSON', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');
    
    const result = await getAssets();
    
    expect(result).toEqual({});
  });
});