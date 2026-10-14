import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import StickyNoteComponent from '../StickyNote';
import { StickyNoteShape } from '../../models/Shape';

test('renders sticky note and allows editing', () => {
  const shape: StickyNoteShape = {
    id: 'note1',
    type: 'sticky',
    x: 50,
    y: 50,
    width: 200,
    height: 150,
    content: 'Hello',
    selected: false,
    color: '#ffeb3b',
    strokeWidth: 1,
  };
  const onSelect = jest.fn();
  const onUpdate = jest.fn();

  const { getByText } = render(<StickyNoteComponent shape={shape} onSelect={onSelect} onUpdate={onUpdate} />);
  const div = getByText('Hello');
  expect(div).toBeInTheDocument();

  // simulate edit
  fireEvent.blur(div, { target: { textContent: 'Edited' } });
  expect(onUpdate).toHaveBeenCalled();
});
