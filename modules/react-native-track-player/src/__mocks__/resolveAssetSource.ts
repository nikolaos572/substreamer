const resolveAssetSource = jest.fn((id: number) => ({ uri: `asset://${id}` }));
export default resolveAssetSource;
