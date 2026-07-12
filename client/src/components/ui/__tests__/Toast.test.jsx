/**
 * File purpose: Tests the shared toast provider used for loading/error/success feedback.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToasts } from '../Toast.jsx';

/**
 * Small test component that exposes the toast context through a normal button click.
 * Testing through context mirrors how production pages trigger notifications.
 * @returns {JSX.Element} Rendered toast trigger button.
 */
function ToastTrigger() {
  const { showToast } = useToasts();
  return <button type="button" onClick={() => showToast('Saved successfully.', 'success')}>Show toast</button>;
}

describe('ToastProvider', () => {
  it('renders toast notifications with the selected tone and message', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /show toast/i }));

    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
    expect(screen.getByText('Saved successfully.')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
  });
});
