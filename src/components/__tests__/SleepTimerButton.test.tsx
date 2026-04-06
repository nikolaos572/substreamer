jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#ff6600',
      textPrimary: '#ffffff',
      textSecondary: '#888888',
    },
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string; color: string; size: number }) => (
      <Text testID={`icon-${props.name}`} style={{ color: props.color }}>
        {props.name}
      </Text>
    ),
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { sleepTimerStore } from '../../store/sleepTimerStore';

// Must import after mocks
const { SleepTimerButton } = require('../SleepTimerButton');

beforeEach(() => {
  sleepTimerStore.setState({
    endTime: null,
    endOfTrack: false,
    remaining: null,
    sheetVisible: false,
  });
});

describe('SleepTimerButton', () => {
  it('renders moon-outline icon when inactive', () => {
    const { getByTestId } = render(<SleepTimerButton />);
    expect(getByTestId('icon-moon-outline')).toBeTruthy();
  });

  it('renders filled moon icon when timed timer is active', () => {
    sleepTimerStore.setState({ endTime: Date.now() / 1000 + 600 });
    const { getByTestId } = render(<SleepTimerButton />);
    expect(getByTestId('icon-moon')).toBeTruthy();
  });

  it('renders filled moon icon when endOfTrack is active', () => {
    sleepTimerStore.setState({ endOfTrack: true });
    const { getByTestId } = render(<SleepTimerButton />);
    expect(getByTestId('icon-moon')).toBeTruthy();
  });

  it('uses primary color when active', () => {
    sleepTimerStore.setState({ endTime: Date.now() / 1000 + 600 });
    const { getByTestId } = render(<SleepTimerButton />);
    expect(getByTestId('icon-moon').props.style.color).toBe('#ff6600');
  });

  it('uses textPrimary color when inactive', () => {
    const { getByTestId } = render(<SleepTimerButton />);
    expect(getByTestId('icon-moon-outline').props.style.color).toBe('#ffffff');
  });

  it('shows countdown when active with remaining seconds', () => {
    sleepTimerStore.setState({ endTime: Date.now() / 1000 + 600, remaining: 125 });
    const { getByText } = render(<SleepTimerButton />);
    expect(getByText('2:05')).toBeTruthy();
  });

  it('formats countdown with hours when >= 3600s', () => {
    sleepTimerStore.setState({ endTime: Date.now() / 1000 + 3700, remaining: 3661 });
    const { getByText } = render(<SleepTimerButton />);
    expect(getByText('1:01:01')).toBeTruthy();
  });

  it('does not show countdown when inactive', () => {
    const { queryByText } = render(<SleepTimerButton />);
    expect(queryByText(/\d:\d/)).toBeNull();
  });

  it('does not show countdown when remaining is null', () => {
    sleepTimerStore.setState({ endTime: Date.now() / 1000 + 600, remaining: null });
    const { queryByText } = render(<SleepTimerButton />);
    expect(queryByText(/\d:\d/)).toBeNull();
  });

  it('opens sheet on press', () => {
    const { getByRole } = render(<SleepTimerButton />);
    fireEvent.press(getByRole('button'));
    expect(sleepTimerStore.getState().sheetVisible).toBe(true);
  });

  it('has accessibility role and label', () => {
    const { getByRole } = render(<SleepTimerButton />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Sleep Timer');
  });
});
