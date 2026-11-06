import { render, screen } from '@testing-library/react';
import App from '../src/ui/App';

test('App renders the product name', () => {
  render(<App />);
  expect(screen.getByText('Balance')).toBeInTheDocument();
});
