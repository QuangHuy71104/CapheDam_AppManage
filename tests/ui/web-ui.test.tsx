// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pressable, TextInput, View } from '../../lib/web-ui';

afterEach(cleanup);

describe('web UI accessibility adapters', () => {
  it('uses the placeholder as an accessible fallback name', () => {
    render(<TextInput onChangeText={() => undefined} placeholder="Số lượng" value="" />);

    expect(screen.getByRole('textbox', { name: 'Số lượng' })).toBeInTheDocument();
  });

  it('does not invoke a disabled press action', () => {
    const onPress = vi.fn();
    render(
      <Pressable disabled onPress={onPress}>
        Gửi
      </Pressable>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('makes compatibility views with button semantics keyboard operable', () => {
    const onClick = vi.fn();
    render(<View accessibilityLabel="Xếp ca" accessibilityRole="button" onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Xếp ca' });
    expect(button).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });
});
