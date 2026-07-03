// Stub for jest-expo@53 compatibility with expo-modules-core@57
// These paths changed between SDK versions; this module provides compatible stubs.
const v4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
const v5 = () => '00000000-0000-5000-8000-000000000000';

module.exports = { default: { v4, v5 }, v4, v5 };
