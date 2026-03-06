export default {
  listDirectoryAsync: jest.fn().mockResolvedValue([]),
  getDirectorySizeAsync: jest.fn().mockResolvedValue(0),
  downloadFileAsyncWithProgress: jest.fn().mockResolvedValue({ uri: '', bytes: 0 }),
  addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};
