import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GradientCard } from './GradientCard';

describe('GradientCard', () => {
  it('renders correctly and handles press events', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <GradientCard onPress={onPress}>
        <text>Test</text>
      </GradientCard>
    );

    // Check if the component renders the children
    expect(getByText('Test')).not.toBeNull();

    // Press the component
    fireEvent.press(getByText('Test'));

    // Check if the onPress handler was called
    expect(onPress).toHaveBeenCalled();
  });
});