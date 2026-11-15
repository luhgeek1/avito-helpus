import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { attach, runtime } from '../../packages/react/src/runtime';
import { useSession, watchSession, resetSessionForTests } from '../../packages/react/src/session';
import { OrbiCompanion } from '../../packages/react/src';
import { tokens, refreshSession } from '../../packages/react/src/http';
import { controls } from '../../packages/react/src/controls';
import { Link, useLoginDialog } from '../../packages/react/src/navigation';

it('rejects invalid URLs and duplicate widgets before creating a client', () => {
  expect(() => runtime()).toThrow('Mount');
  expect(() => attach({ apiUrl: 'https://user:secret@example.test' })).toThrow('apiUrl');
  const detach = attach({});
  expect(() => attach({})).toThrow('Only one');
  detach();
});

it('reports a rejected widget without breaking the host or the mounted instance', async () => {
  const onError = vi.fn();
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const first = render(<OrbiCompanion mode="guide" />);
  await waitFor(() => expect(document.querySelectorAll('[data-orbi-sdk]')).toHaveLength(1));
  const duplicate = render(<OrbiCompanion mode="guide" onError={onError} />);
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Only one') }));
  duplicate.unmount();
  expect(document.querySelectorAll('[data-orbi-sdk]')).toHaveLength(1);
  expect(runtime().props.mode).toBe('guide');
  first.unmount();
  render(<OrbiCompanion apiUrl="ftp://example.test" />);
  expect(logged).toHaveBeenCalledWith('[OrbiCompanion]', expect.objectContaining({ message: expect.stringContaining('apiUrl') }));
  expect(document.querySelector('[data-orbi-sdk]')).toBeNull();
});

it('forgets the account when its refresh fails and unsubscribes token observers', async () => {
  const detach = attach({ getToken: () => null });
  const stop = watchSession();
  const changed = vi.fn();
  const unsubscribe = tokens.subscribe(changed);
  useSession.setState({ status: 'authenticated' });
  tokens.set('temporary');
  expect(tokens.get()).toBe('temporary');
  await refreshSession();
  expect(useSession.getState().status).toBe('anonymous');
  expect(changed).toHaveBeenLastCalledWith(null);
  unsubscribe(); stop(); resetSessionForTests(); detach();
});

it('reports token-provider failures and ignores a late response after unmount', async () => {
  const onError = vi.fn();
  const view = render(<OrbiCompanion getToken={() => { throw new Error('SSO offline'); }} onError={onError} />);
  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(useSession.getState().status).toBe('anonymous');
  view.unmount();
  let resolve!: (token: string) => void;
  const second = render(<OrbiCompanion getToken={() => new Promise((done) => { resolve = done; })} />);
  second.unmount();
  await act(async () => { resolve('old-account'); });
  expect(useSession.getState().status).toBe('unknown');
});

it('routes host links explicitly and keeps the embedded login cancellable', async () => {
  const navigate = vi.fn();
  const detach = attach({ onNavigate: navigate, portalUrl: 'https://portal.example.test' });
  const view = render(<Link to="/plan">Plan</Link>);
  expect(view.getByRole('link')).toHaveAttribute('href', 'https://portal.example.test/plan');
  fireEvent.click(view.getByRole('link'));
  expect(navigate).toHaveBeenCalledWith('/plan');
  view.unmount(); detach();
  render(<OrbiCompanion />);
  await waitFor(() => expect(useSession.getState().status).toBe('anonymous'));
  act(() => { controls.openChat(); useLoginDialog.getState().show(true); });
  const root = document.querySelector('[data-orbi-sdk]')!.shadowRoot!.querySelector<HTMLElement>('.orbi-surface')!;
  fireEvent.click(within(root).getByRole('button', { name: 'Закрыть' }));
  expect(useLoginDialog.getState().open).toBe(false);
  act(() => useLoginDialog.getState().show(true));
  fireEvent(root.querySelector<HTMLDialogElement>('[aria-labelledby="orbi-login-title"]')!, new Event('cancel', { bubbles: true }));
  expect(useLoginDialog.getState().open).toBe(false);
});
