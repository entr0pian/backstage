import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ComponentPicker } from './ComponentPicker';

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [
      { metadata: { name: 'payments', description: 'payments service' } },
      { metadata: { name: 'checkout' } },
    ],
  }),
};

const render = (formData: string | undefined, onChange = jest.fn()) =>
  renderInTestApp(
    <ComponentPicker
      {...({
        formData,
        onChange,
        required: true,
        rawErrors: [],
        schema: { title: 'Component', description: 'The service to deploy.' },
      } as any)}
    />,
    { apis: [[catalogApiRef, catalogApi]] },
  );

describe('ComponentPicker', () => {
  beforeEach(() => catalogApi.getEntities.mockClear());

  it('stays locked to the service the form was opened from', async () => {
    await render('payments');
    expect(screen.getByDisplayValue('payments')).toBeDisabled();
    expect(catalogApi.getEntities).not.toHaveBeenCalled();
  });

  it('lets you pick a service when opened without one', async () => {
    const onChange = jest.fn();
    await render(undefined, onChange);
    await waitFor(() => expect(catalogApi.getEntities).toHaveBeenCalled());
    fireEvent.mouseDown(await screen.findByRole('button'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(o => o.textContent)).toEqual([
      'checkout',
      'paymentspayments service',
    ]);
    fireEvent.click(within(listbox).getByText('checkout'));
    expect(onChange).toHaveBeenCalledWith('checkout');
  });
});
