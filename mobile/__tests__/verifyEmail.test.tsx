import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { mockTheme, mockStyles, makeWrapper } from '../src/__mocks__/testUtils';

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  Link: ({ children }: any) => children,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const mockVerify = jest.fn().mockResolvedValue({ message: 'ok' });
const mockResend = jest.fn().mockResolvedValue({ message: 'sent' });
jest.mock('../src/lib/api', () => ({
  api: {
    verifyEmail: (...a: unknown[]) => mockVerify(...a),
    requestVerification: (...a: unknown[]) => mockResend(...a),
  },
}));

import { render, fireEvent } from '@testing-library/react-native';
import VerifyEmailScreen from '../app/verify-email';

describe('VerifyEmailScreen', () => {
  it('submits the code and goes back on success', async () => {
    const { getByPlaceholderText, getByText } = await render(<VerifyEmailScreen />, {
      wrapper: makeWrapper(),
    });
    await fireEvent.changeText(getByPlaceholderText('6-digit code'), '123456');
    await fireEvent.press(getByText('Verify'));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('fires resend', async () => {
    const { getByText } = await render(<VerifyEmailScreen />, { wrapper: makeWrapper() });
    await fireEvent.press(getByText('Resend code'));
    await waitFor(() => expect(mockResend).toHaveBeenCalled());
  });
});
