import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { mockTheme, mockStyles, makeWrapper } from '../src/__mocks__/testUtils';

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: ({ children }: any) => children,
}));
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return { Image: View };
});

const mockTryOn = jest.fn().mockResolvedValue({ job_id: 'j1', status: 'queued' });
const mockListWardrobe = jest.fn().mockResolvedValue([
  { id: 'a', category: 'tops', name: 'linen shirt', image_url: 'http://x/a.png', clean_image_url: null },
  { id: 'b', category: 'bottoms', name: 'chinos', image_url: 'http://x/b.png', clean_image_url: null },
]);
jest.mock('../src/lib/api', () => ({
  api: {
    tryOnOutfit: (...a: unknown[]) => mockTryOn(...a),
    listWardrobe: (...a: unknown[]) => mockListWardrobe(...a),
  },
}));

import { OutfitSuggestionCard, ShopResultsRow } from '../src/features/stylist/ChatActionCards';

describe('OutfitSuggestionCard', () => {
  it('shows matched wardrobe items and fires try-on', async () => {
    const { getByText } = await render(<OutfitSuggestionCard itemIds={['a', 'b']} />, {
      wrapper: makeWrapper(),
    });
    await waitFor(() => getByText('linen shirt'));
    await fireEvent.press(getByText('Try it on'));
    await waitFor(() => expect(mockTryOn).toHaveBeenCalledWith(['a', 'b']));
  });
});

describe('ShopResultsRow', () => {
  it('renders product title, store and price', async () => {
    const { getByText } = await render(
      <ShopResultsRow
        currency="USD"
        results={[
          {
            title: 'Denim jacket',
            price: 79,
            currency: 'USD',
            image_url: '',
            product_url: 'https://store.example/dj',
            source: 'Example Store',
            category: 'tops',
          },
        ]}
      />,
      { wrapper: makeWrapper() },
    );
    getByText('Denim jacket');
    getByText('Example Store');
    getByText('$79');
  });
});
