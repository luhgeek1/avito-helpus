import { StrictMode, createRef } from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrbiCompanion } from '../../packages/react/src';
import type { OrbiHandle } from '../../packages/react/src/types';
import { useSession } from '../../packages/react/src/session';
import { useOrbiChat } from '@/features/orbi-chat';
import { controls } from '../../packages/react/src/controls';

const shadow = () => within(document.querySelector('[data-orbi-sdk]')!.shadowRoot!.querySelector<HTMLElement>('.orbi-surface')!);

describe('installable companion', () => {
  it('mounts in StrictMode, toggles guide chat, keeps preferences and cleans up', async () => {
    const ref = createRef<OrbiHandle>();
    const view = render(<StrictMode><OrbiCompanion mode="guide" ref={ref} nonce="test-nonce" /></StrictMode>);
    await waitFor(() => expect(shadow().getByRole('button', { name: 'Чат' })).toBeInTheDocument());
    expect(document.querySelectorAll('[data-orbi-sdk]')).toHaveLength(1);
    expect(document.querySelector('[data-orbi-sdk]')!.shadowRoot!.querySelector('style')!.nonce).toBe('test-nonce');
    act(() => ref.current!.ask('Как установить npm библиотеку?'));
    expect(shadow().getByRole('dialog')).toBeInTheDocument();
    expect(shadow().getByText(/Библиотека @orbi-companion/)).toBeInTheDocument();
    fireEvent.click(shadow().getByRole('button', { name: 'Чат' }));
    expect(shadow().queryByRole('dialog')).toBeNull();
    act(() => ref.current!.openChat());
    expect(shadow().getByText(/Библиотека @orbi-companion/)).toBeInTheDocument();
    act(() => { ref.current!.startOver(); ref.current!.ask(''); });
    await act(() => ref.current!.refreshSession());
    expect(shadow().getByText('Помогу установить себя')).toBeInTheDocument();
    view.rerender(<StrictMode><OrbiCompanion mode="guide" ref={ref} zIndex={3000} /></StrictMode>);
    expect(document.querySelector<HTMLElement>('[data-orbi-sdk]')!.style.zIndex).toBe('3000');
    view.unmount();
    expect(document.querySelector('[data-orbi-sdk]')).toBeNull();
    expect(localStorage.getItem('buddy-pet')).toBe('orbit');
  });

  it('signs in without a host login route and streams a confirmation card', async () => {
    const ref = createRef<OrbiHandle>();
    render(<OrbiCompanion ref={ref} />);
    await waitFor(() => expect(useSession.getState().status).toBe('anonymous'));
    act(() => controls.ask('Private question'));
    fireEvent.click(shadow().getByRole('link', { name: 'Войти' }));
    fireEvent.change(shadow().getByLabelText('Рабочая почта'), { target: { value: 'anya.intern@buddy.test' } });
    fireEvent.change(shadow().getByLabelText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(shadow().getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(shadow().getByRole('alert')).toHaveTextContent('Не удалось войти'));
    fireEvent.change(shadow().getByLabelText('Пароль'), { target: { value: 'orbi-demo-2026' } });
    fireEvent.click(shadow().getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(useSession.getState().status).toBe('authenticated'));
    act(() => ref.current!.ask('Доступ к listings-api'));
    await waitFor(() => expect(shadow().getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
    fireEvent.click(shadow().getByRole('button', { name: 'Подтвердить' }));
    await waitFor(() => expect(shadow().getByText('Подтверждено')).toBeInTheDocument());
    act(() => ref.current!.startOver());
    expect(useOrbiChat.getState().messages).toHaveLength(0);
    await act(() => useSession.getState().logout());
    expect(useSession.getState().status).toBe('anonymous');
  });

  it('discards private state on account change and reports missing host authentication', async () => {
    const onError = vi.fn();
    const view = render(<OrbiCompanion sessionKey="one" getToken={() => 'first'} onError={onError} />);
    await waitFor(() => expect(useSession.getState().status).toBe('authenticated'));
    act(() => controls.ask('Доступ к listings-api'));
    await waitFor(() => expect(useOrbiChat.getState().messages.length).toBeGreaterThan(1));
    view.rerender(<OrbiCompanion sessionKey="two" getToken={() => null} onError={onError} />);
    await waitFor(() => expect(useSession.getState().status).toBe('anonymous'));
    expect(useOrbiChat.getState().messages).toHaveLength(0);
    act(() => controls.ask('Hidden question'));
    expect(onError).toHaveBeenCalledOnce();
    view.rerender(<OrbiCompanion sessionKey="two" getToken={() => 'new-token'} onError={onError} />);
    await act(() => controls.refreshSession());
    expect(useSession.getState().status).toBe('authenticated');
  });
});

it('locks the page during the tour without requiring host CSS and restores it', async () => {
  document.body.style.overflow = 'clip';
  const view = render(<OrbiCompanion mode="guide" autoStartTour />);
  await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
  view.unmount();
  expect(document.body.style.overflow).toBe('clip');
  document.body.style.overflow = '';
});
